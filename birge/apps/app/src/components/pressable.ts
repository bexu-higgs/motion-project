import type { PressableStateCallbackType } from 'react-native';

/** react-native-web Pressable-ге тінтуір апарылғанын да хабарлайды. */
export type InteractionState = PressableStateCallbackType & { hovered?: boolean };
