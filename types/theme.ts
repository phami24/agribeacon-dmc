// types/theme.ts
import { ViewStyle, TextStyle, ImageStyle } from 'react-native';

export interface MissionTheme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    polygonFill: string;
    polygonLine: string;
    waypointLine: string;
    waypointMarker: string;
    droneMarker: string;
    buttonPrimary: string;
    buttonSecondary: string;
    buttonDisabled: string;
    buttonText: string;
    buttonTextSecondary: string;
  };
  styles: {
    topBar?: ViewStyle;
    backButton?: ViewStyle;
    backButtonCircle?: ViewStyle;
    backButtonIcon?: TextStyle;
    statusContainer?: ViewStyle;
    sidebar?: ViewStyle;
    sidebarContent?: ViewStyle;
    parameterSection?: ViewStyle;
    parameterLabel?: TextStyle;
    directionValue?: TextStyle;
    directionUnit?: TextStyle;
    inputContainer?: ViewStyle;
    valueInput?: TextStyle;
    altitudeButton?: ViewStyle;
    altitudeButtonDisabled?: ViewStyle;
    altitudeButtonText?: TextStyle;
    sendButton?: ViewStyle;
    sendButtonWhite?: ViewStyle;
    sendButtonText?: TextStyle;
    sendButtonTextBlack?: TextStyle;
    startButton?: ViewStyle;
    startButtonDisabled?: ViewStyle;
    startButtonText?: TextStyle;
    drawToolbar?: ViewStyle;
    drawIconButton?: ViewStyle;
    drawIconButtonActive?: ViewStyle;
    drawIconButtonDisabled?: ViewStyle;
    drawIconText?: TextStyle;
    drawPointMarker?: ViewStyle;
    drawPointMarkerDelete?: ViewStyle;
    waypointMarker?: ViewStyle;
    waypointNumber?: TextStyle;
    loadingOverlay?: ViewStyle;
    loadingContainer?: ViewStyle;
    loadingText?: TextStyle;
    modalOverlay?: ViewStyle;
    modalContent?: ViewStyle;
    modalTitle?: TextStyle;
    modalWPText?: TextStyle;
    bottomRightButton?: ViewStyle;
    bottomRightButtonText?: TextStyle;
    bottomRightButtonIcon?: TextStyle;
  };
}

export const defaultMissionTheme: MissionTheme = {
  colors: {
    primary: '#2196F3',
    secondary: '#4CAF50',
    success: '#4CAF50',
    warning: '#ffaa00',
    error: '#ff4444',
    background: '#000',
    surface: 'rgba(0, 0, 0, 0.75)',
    text: '#fff',
    textSecondary: '#B0BEC5',
    border: 'rgba(255, 255, 255, 0.2)',
    polygonFill: 'rgba(33, 150, 243, 0.2)',
    polygonLine: '#2196F3',
    waypointLine: '#ff6f00',
    waypointMarker: '#ff6f00',
    droneMarker: '#2196F3',
    buttonPrimary: '#4CAF50',
    buttonSecondary: '#fff',
    buttonDisabled: '#9E9E9E',
    buttonText: '#fff',
    buttonTextSecondary: '#000',
  },
  styles: {},
};

