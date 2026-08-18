require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |spec|
  spec.name = 'FigmaGradientBlur'
  spec.version = package['version']
  spec.summary = 'Figma-matched gradient-masked iOS blur view for PLOG.'
  spec.homepage = 'https://github.com/jeonginsu5213/game-diary'
  spec.license = { type: 'UNLICENSED' }
  spec.authors = { 'PLOG' => 'support@plog.app' }
  spec.platforms = { ios: '15.1' }
  spec.source = { git: spec.homepage, tag: spec.version.to_s }
  spec.static_framework = true
  spec.source_files = '**/*.{h,m,mm,swift}'
  spec.dependency 'ExpoModulesCore'
  spec.swift_version = '5.9'
end
