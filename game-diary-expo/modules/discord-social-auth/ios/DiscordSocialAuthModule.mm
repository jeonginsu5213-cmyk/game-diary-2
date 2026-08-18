#import "DiscordSocialAuthorizer.h"
#define DISCORDPP_IMPLEMENTATION
#import <discord_partner_sdk/discordpp.h>

@interface DiscordSocialAuthorizer () {
 @private
  std::unique_ptr<discordpp::Client> client_;
  NSTimer *callbackTimer_;
  BOOL authorizationInProgress_;
}
@end

@implementation DiscordSocialAuthorizer

- (void)invalidateCallbackTimer
{
  [callbackTimer_ invalidate];
  callbackTimer_ = nil;
}

- (void)startCallbackTimer
{
  [self invalidateCallbackTimer];
  callbackTimer_ = [NSTimer scheduledTimerWithTimeInterval:(1.0 / 60.0)
                                                    repeats:YES
                                                      block:^(__unused NSTimer *timer) {
    discordpp::RunCallbacks();
  }];
}

- (void)dealloc
{
  [self invalidateCallbackTimer];
}

- (void)authorizeWithApplicationId:(NSString *)applicationId
                            resolve:(DiscordSocialAuthResolveBlock)resolve
                             reject:(DiscordSocialAuthRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (authorizationInProgress_) {
      reject(@"E_DISCORD_AUTH_IN_PROGRESS", @"Discord authorization is already in progress.");
      return;
    }

    NSCharacterSet *nonDigits = [[NSCharacterSet decimalDigitCharacterSet] invertedSet];
    if (applicationId.length == 0 || [applicationId rangeOfCharacterFromSet:nonDigits].location != NSNotFound) {
      reject(@"E_DISCORD_APP_ID", @"Discord application ID is invalid.");
      return;
    }

    try {
      client_ = std::make_unique<discordpp::Client>();
      const auto verifier = client_->CreateAuthorizationCodeVerifier();
      const std::string verifierValue = verifier.Verifier();
      if (verifierValue.empty()) {
        reject(@"E_DISCORD_PKCE", @"Discord PKCE verifier could not be created.");
        return;
      }

      discordpp::AuthorizationArgs args;
      args.SetClientId(strtoull(applicationId.UTF8String, nullptr, 10));
      args.SetScopes("identify email openid sdk.social_layer_presence");
      args.SetCodeChallenge(verifier.Challenge());

      authorizationInProgress_ = YES;
      [self startCallbackTimer];

      __weak DiscordSocialAuthorizer *weakSelf = self;
      DiscordSocialAuthResolveBlock resolveBlock = [resolve copy];
      DiscordSocialAuthRejectBlock rejectBlock = [reject copy];
      client_->Authorize(args, [weakSelf, verifierValue, resolveBlock, rejectBlock](discordpp::ClientResult result,
                                                                                     std::string code,
                                                                                     std::string redirectUri) {
        dispatch_async(dispatch_get_main_queue(), ^{
          DiscordSocialAuthorizer *strongSelf = weakSelf;
          if (!strongSelf) {
            return;
          }

          strongSelf->authorizationInProgress_ = NO;
          [strongSelf invalidateCallbackTimer];

          if (!result.Successful() || code.empty() || redirectUri.empty()) {
            const std::string error = result.Error().empty() ? result.ToString() : result.Error();
            NSString *message = error.empty()
              ? @"Discord authorization was cancelled or failed."
              : [NSString stringWithUTF8String:error.c_str()];
            rejectBlock(@"E_DISCORD_AUTH", message);
            return;
          }

          resolveBlock(@{
            @"code": [NSString stringWithUTF8String:code.c_str()],
            @"codeVerifier": [NSString stringWithUTF8String:verifierValue.c_str()],
            @"redirectUri": [NSString stringWithUTF8String:redirectUri.c_str()],
          });
        });
      });
    } catch (const std::exception &error) {
      authorizationInProgress_ = NO;
      [self invalidateCallbackTimer];
      reject(@"E_DISCORD_SDK", [NSString stringWithUTF8String:error.what()]);
    }
  });
}

@end
