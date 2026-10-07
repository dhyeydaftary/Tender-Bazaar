// Type declarations for modules without types

declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { Component } from 'react';
  import { TextProps } from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export default class Icon extends Component<IconProps> {}
}

declare module 'react-native-vector-icons/Feather' {
  import { Component } from 'react';
  import { TextProps } from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export default class Icon extends Component<IconProps> {}
}

declare module 'react-native-vector-icons/Ionicons' {
  import { Component } from 'react';
  import { TextProps } from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export default class Icon extends Component<IconProps> {}
}

declare module 'react-native-haptic-feedback' {
  type HapticFeedbackTypes =
    | 'impactLight'
    | 'impactMedium'
    | 'impactHeavy'
    | 'rigid'
    | 'soft'
    | 'notificationSuccess'
    | 'notificationWarning'
    | 'notificationError'
    | 'selection';

  interface HapticOptions {
    enableVibrateFallback?: boolean;
    ignoreAndroidSystemSettings?: boolean;
  }

  const ReactNativeHapticFeedback: {
    trigger(type: HapticFeedbackTypes, options?: HapticOptions): void;
  };

  export default ReactNativeHapticFeedback;
}

declare module 'react-native-linear-gradient' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  interface LinearGradientProps extends ViewProps {
    colors: string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    locations?: number[];
  }

  export default class LinearGradient extends Component<LinearGradientProps> {}
}

declare module 'react-native-config' {
  interface Config {
    API_URL?: string;
    [key: string]: string | undefined;
  }

  const Config: Config;
  export default Config;
}

declare module 'react-native-fast-image' {
  import { Component } from 'react';
  import { ViewProps, ImageSourcePropType } from 'react-native';

  interface FastImageProps extends ViewProps {
    source: { uri: string; priority?: string; cache?: string } | ImageSourcePropType;
    resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
    onLoad?: () => void;
    onError?: () => void;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    fallback?: boolean;
  }

  export default class FastImage extends Component<FastImageProps> {
    static resizeMode: {
      contain: string;
      cover: string;
      stretch: string;
      center: string;
    };
    static priority: {
      low: string;
      normal: string;
      high: string;
    };
  }
}

declare module 'lottie-react-native' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  interface LottieViewProps extends ViewProps {
    source: object | string;
    autoPlay?: boolean;
    loop?: boolean;
    speed?: number;
    progress?: number | object;
    resizeMode?: 'cover' | 'contain' | 'center';
    onAnimationFinish?: (isCancelled: boolean) => void;
    colorFilters?: Array<{ keypath: string; color: string }>;
  }

  export default class LottieView extends Component<LottieViewProps> {
    play(startFrame?: number, endFrame?: number): void;
    reset(): void;
    pause(): void;
    resume(): void;
  }
}

declare module '*.json' {
  const value: any;
  export default value;
}

declare module 'react-native-razorpay' {
  interface RazorpayCheckoutOptions {
    key: string;
    order_id: string;
    amount: number;
    currency?: string;
    name?: string;
    description?: string;
    image?: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    theme?: {
      color?: string;
    };
    modal?: {
      confirm_close?: boolean;
      animation?: boolean;
    };
    retry?: {
      enabled?: boolean;
      max_count?: number;
    };
    notes?: Record<string, string>;
  }

  interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<RazorpaySuccessResponse>;
  };

  export default RazorpayCheckout;
}

declare module 'react-native-share' {
  interface ShareOptions {
    title?: string;
    message?: string;
    url?: string;
    type?: string;
    subject?: string;
  }

  const Share: {
    open(options: ShareOptions): Promise<{ success: boolean; message: string }>;
  };

  export default Share;
}
