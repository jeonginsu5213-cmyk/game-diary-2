import { requireNativeViewManager } from 'expo-modules-core'
import type { ComponentType } from 'react'
import { NativeModules, type ViewProps } from 'react-native'

const nativeViewName = 'FigmaGradientBlur'
const nativeViewConfig = NativeModules.NativeUnimoduleProxy?.viewManagersMetadata?.[nativeViewName]

export const NativeFigmaGradientBlurView: ComponentType<ViewProps> | null = nativeViewConfig
  ? requireNativeViewManager<ViewProps>(nativeViewName)
  : null
