require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |spec|
  spec.name = 'DiscordSocialAuth'
  spec.version = package['version']
  spec.summary = 'Discord Social SDK authorization bridge for PLOG.'
  spec.homepage = 'https://github.com/jeonginsu5213/game-diary'
  spec.license = { type: 'UNLICENSED' }
  spec.authors = { 'PLOG' => 'support@plog.app' }
  spec.platforms = { ios: '15.1' }
  spec.source = { git: spec.homepage, tag: spec.version.to_s }
  spec.static_framework = true
  spec.source_files = '*.{h,mm,swift}'
  spec.vendored_frameworks = 'vendor/discord_partner_sdk.xcframework'
  spec.dependency 'ExpoModulesCore'
  spec.dependency 'React-Core'
  spec.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'CLANG_CXX_LIBRARY' => 'libc++',
  }
end
