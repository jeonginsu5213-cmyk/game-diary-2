import ExpoModulesCore
import UIKit

final class FigmaGradientBlurView: ExpoView {
  private let blurView = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
  private let fillGradient = CAGradientLayer()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    clipsToBounds = true
    layer.cornerRadius = 12
    backgroundColor = .clear

    blurView.frame = bounds
    blurView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    blurView.isUserInteractionEnabled = false
    addSubview(blurView)

    fillGradient.colors = [
      UIColor.white.cgColor,
      UIColor.white.withAlphaComponent(0.3).cgColor,
      UIColor.white.withAlphaComponent(0).cgColor,
    ]
    fillGradient.locations = [0, 0.48, 1]
    fillGradient.startPoint = CGPoint(x: 0.5, y: 0)
    fillGradient.endPoint = CGPoint(x: 0.5, y: 1)
    layer.addSublayer(fillGradient)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    fillGradient.frame = bounds
  }
}
