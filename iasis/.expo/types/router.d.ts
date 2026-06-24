/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(tabs)` | `/_sitemap` | `/auth` | `/auth/login` | `/auth/register` | `/tabs` | `/tabs/device` | `/tabs/history` | `/tabs/home` | `/tabs/profile` | `/tabs/schedule`;
      DynamicRoutes: never;
      DynamicRouteTemplate: never;
    }
  }
}
