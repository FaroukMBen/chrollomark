// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'book.fill': 'menu-book',
  'magnifyingglass': 'search',
  'person.2.fill': 'people',
  'person.crop.circle': 'person',
  'plus.circle.fill': 'add-circle',
  'plus': 'add',
  'star.fill': 'star',
  'star': 'star-border',
  'heart.fill': 'favorite',
  'heart': 'favorite-border',
  'trash': 'delete',
  'pencil': 'edit',
  'xmark': 'close',
  'xmark.circle.fill': 'cancel',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'checkmark': 'check',
  'clock': 'schedule',
  'photo': 'image',
  'camera.fill': 'photo-camera',
  'bookmark.fill': 'bookmark',
  'bookmark': 'bookmark-border',
  'ellipsis': 'more-horiz',
  'person.badge.plus': 'person-add',
  'chart.bar.fill': 'bar-chart',
  'folder.fill': 'folder',
  'lock.fill': 'lock',
  'lock.open': 'lock-open',
  'eye.fill': 'visibility',
  'eye.slash.fill': 'visibility-off',
  'envelope.fill': 'email',
  'arrow.up.right': 'open-in-new',
  'exclamationmark.triangle': 'warning',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
