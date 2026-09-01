import { Feature, View } from '../../../src/runtime/View'
import {
  Appearance,
  Diagnostics,
  Motion,
  SaveBar,
  SettingsHeader,
} from '../features/features'

export function Settings({ state }: { state?: string }) {
  return (
    <View state={state} id="settings">
      <Feature fid="settings.settings-header" slot="masthead/1" requires="before-main">
        <SettingsHeader />
      </Feature>
      <Feature fid="settings.appearance" slot="body/1">
        <Appearance />
      </Feature>
      <Feature fid="settings.motion" slot="body/2">
        <Motion />
      </Feature>
      <Feature fid="settings.diagnostics" slot="body/2" states="advanced">
        <Diagnostics />
      </Feature>
      <Feature fid="settings.save-bar" slot="footer/1" requires="after-main">
        <SaveBar />
      </Feature>
    </View>
  )
}
