// components/SignalBars.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

interface SignalBarsProps {
  rssi: number | null;
  size?: 'small' | 'medium' | 'large';
}

export const SignalBars: React.FC<SignalBarsProps> = ({ rssi, size = 'medium' }) => {
  if (rssi === null) {
    return (
      <View style={styles.container}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.bar,
              styles[size],
              styles.barInactive,
              { marginLeft: index > 0 ? 2 : 0 },
            ]}
          />
        ))}
      </View>
    );
  }

  // Tính số bars và màu sắc dựa trên RSSI
  const getSignalInfo = (rssi: number) => {
    if (rssi > -60) {
      return { bars: 4, color: '#4CAF50' }; // Xanh lá - Excellent
    } else if (rssi > -75) {
      return { bars: 3, color: '#2196F3' }; // Xanh dương - Good
    } else if (rssi > -85) {
      return { bars: 2, color: '#FF9800' }; // Cam - Fair
    } else if (rssi > -95) {
      return { bars: 1, color: '#F44336' }; // Đỏ - Poor
    } else {
      return { bars: 0, color: '#D32F2F' }; // Đỏ đậm - Very Poor
    }
  };

  const { bars, color } = getSignalInfo(rssi);
  const barHeights = [8, 12, 16, 20]; // Heights cho 4 bars

  return (
    <View style={styles.container}>
      {[0, 1, 2, 3].map((index) => {
        const isActive = index < bars;
        const height = size === 'small' 
          ? barHeights[index] * 0.7 
          : size === 'large' 
          ? barHeights[index] * 1.3 
          : barHeights[index];

        return (
          <View
            key={index}
            style={[
              styles.bar,
              styles[size],
              {
                height,
                backgroundColor: isActive ? color : '#333',
                marginLeft: index > 0 ? 2 : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 24,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    minHeight: 4,
  },
  small: {
    width: 3,
  },
  medium: {
    width: 4,
  },
  large: {
    width: 5,
  },
  barInactive: {
    backgroundColor: '#333',
  },
});

