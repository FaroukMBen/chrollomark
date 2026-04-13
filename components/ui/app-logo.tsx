import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

interface AppLogoProps {
  size?: number;
  style?: ViewStyle | ViewStyle[];
}

export const AppLogo = ({ size = 100, style }: AppLogoProps) => {
  return (
    <View style={[{ width: size, height: size, overflow: 'hidden', borderRadius: size * 0.25 }, style]}>
      <Image
        source={require('../../assets/images/app-icon-v2.png')}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
      />
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  }
});
