#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^DiscordSocialAuthResolveBlock)(NSDictionary<NSString *, NSString *> *result);
typedef void (^DiscordSocialAuthRejectBlock)(NSString *code, NSString *message);

@interface DiscordSocialAuthorizer : NSObject

- (void)authorizeWithApplicationId:(NSString *)applicationId
                            resolve:(DiscordSocialAuthResolveBlock)resolve
                             reject:(DiscordSocialAuthRejectBlock)reject;

@end

NS_ASSUME_NONNULL_END
