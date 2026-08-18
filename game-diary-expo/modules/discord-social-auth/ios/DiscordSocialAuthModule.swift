import ExpoModulesCore

public final class DiscordSocialAuthModule: Module {
  private let authorizer = DiscordSocialAuthorizer()

  public func definition() -> ModuleDefinition {
    Name("DiscordSocialAuth")

    AsyncFunction("authorize") { (applicationId: String, promise: Promise) in
      self.authorizer.authorize(
        withApplicationId: applicationId,
        resolve: { result in
          promise.resolve(result)
        },
        reject: { code, message in
          promise.reject(code, message)
        }
      )
    }
  }
}
