import ExpoModulesCore

public final class FigmaGradientBlurModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FigmaGradientBlur")

    View(FigmaGradientBlurView.self) {}
  }
}
