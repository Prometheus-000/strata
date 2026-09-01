/**
 * A view surface. Every `<Feature>` declares where source puts it, which states
 * include it, and what it needs from wherever it sits.
 *
 * `requires` is the half of the contract the feature owns. A designer dragging
 * this region never sees these words — they see that some slots are not offered.
 */
import { Feature, View } from '../../../src/runtime/View'
import {
  Activity,
  Detail,
  Filters,
  Footnote,
  Masthead,
  PresetGrid,
} from '../features/features'

export function Gallery({ state }: { state?: string }) {
  return (
    <View state={state} id="gallery">
      <Feature fid="gallery.masthead" slot="masthead/1" requires="before-main">
        <Masthead />
      </Feature>
      <Feature fid="gallery.filters" slot="lede/1" states="browse" requires="before-main">
        <Filters />
      </Feature>
      <Feature fid="gallery.activity" slot="lede/2" states="browse">
        <Activity />
      </Feature>
      <Feature fid="gallery.preset-grid" slot="body/1" requires="sole-focus">
        <PresetGrid />
      </Feature>
      <Feature fid="gallery.detail" slot="aside/1" states="focus" requires="dismissible">
        <Detail />
      </Feature>
      <Feature fid="gallery.footnote" slot="footer/1" requires="after-main">
        <Footnote />
      </Feature>
    </View>
  )
}
