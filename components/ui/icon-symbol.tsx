// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * SF Symbols → Material Icons mapping.
 * Add any new SF Symbol names here with their Material Icons equivalent.
 */
const MAPPING = {
  // Navigation & System
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'gear': 'settings',
  'ellipsis': 'more-horiz',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'arrow.up': 'arrow-upward',
  'arrow.down': 'arrow-downward',
  'arrow.up.right': 'open-in-new',
  'xmark': 'close',
  'xmark.circle.fill': 'cancel',
  'plus': 'add',
  'plus.circle.fill': 'add-circle',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check-circle',

  // Books & Content
  'book.fill': 'menu-book',
  'book': 'menu-book',
  'books.vertical.fill': 'library-books',
  'doc.text.fill': 'description',
  'textformat': 'text-fields',

  // Search & View
  'magnifyingglass': 'search',
  'eye.fill': 'visibility',
  'eye.slash.fill': 'visibility-off',

  // People
  'person.2.fill': 'people',
  'person.crop.circle': 'person',
  'person.badge.plus': 'person-add',
  'person.badge.minus': 'person-remove',
  'plus.square.on.square': 'content-copy',

  // Favorites & Rating
  'star.fill': 'star',
  'star': 'star-border',
  'heart.fill': 'favorite',
  'heart': 'favorite-border',

  // Actions
  'trash': 'delete',
  'pencil': 'edit',
  'photo': 'image',
  'camera.fill': 'photo-camera',
  'clock': 'schedule',
  'clock.fill': 'schedule',

  // Bookmarks & Tags
  'bookmark.fill': 'bookmark',
  'bookmark': 'bookmark-border',
  'folder.fill': 'folder',
  'folder': 'folder-open',
  'tag.fill': 'label',

  // Charts & Data
  'chart.bar.fill': 'bar-chart',

  // Lock
  'lock.fill': 'lock',
  'lock.open': 'lock-open',

  // Communication
  'envelope.fill': 'email',

  // Status & Flow
  'pause.circle.fill': 'pause-circle-filled',
  'play.circle.fill': 'play-circle-filled',
  'stop.circle.fill': 'stop-circle',

  // Alerts
  'exclamationmark.triangle': 'warning',

  // Misc
  'flame.fill': 'whatshot',
  'flame': 'whatshot',
  'globe': 'language',
  'sparkles': 'auto-awesome',
  'tray.fill': 'inbox',

  // Theme
  'paintbrush.fill': 'brush',
  'sun.max.fill': 'light-mode',
  'moon.fill': 'dark-mode',

  // Sync/Arrows
  'arrow.triangle.2.circlepath': 'sync',
  'rectangle.portrait.and.arrow.right': 'logout',

  // Grid
  'square.grid.2x2.fill': 'grid-view',
  'square.grid.3x3.fill': 'view-module',

  // Hand/Voting
  'hand.thumbsup': 'thumb-up-off-alt',
  'hand.thumbsup.fill': 'thumb-up',
  'hand.thumbsdown': 'thumb-down-off-alt',
  'hand.thumbsdown.fill': 'thumb-down',

  // List  
  'list.bullet': 'format-list-bulleted',
  'line.3.horizontal.decrease': 'filter-list',
  'textformat.abc': 'sort-by-alpha',
  'minus.circle.fill': 'remove-circle',
  'terminal.fill': 'terminal',
  'list.bullet.rectangle.portrait': 'feed',
  'questionmark.circle.fill': 'help',
  'bubble.left.fill': 'chat-bubble',
  'ant.fill': 'bug-report',
  'link': 'link',
  'arrow.counterclockwise': 'refresh',
  'arrow.down.circle': 'file-download',
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
}: Readonly<{
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}>) {
  const mappedName = MAPPING[name];
  if (!mappedName) {
    // Fallback: show a generic icon instead of crashing
    return <MaterialIcons color={color} size={size} name="help-outline" style={style} />;
  }
  return <MaterialIcons color={color} size={size} name={mappedName} style={style} />;
}
