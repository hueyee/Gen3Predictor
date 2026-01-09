import { type CalcdexRenderMode } from '@showdex/interfaces/calc';

/**
 * Gen3Predictor-specific settings.
 *
 * @since 1.2.6
 */
export interface ShowdexGen3PredictorSettings {
  /**
   * How the Gen3Predictor should automatically open once a Gen 3 OU battle starts.
   *
   * * `'always'` will open the Gen3Predictor for all Gen 3 OU battles.
   * * `'playing'` will only open the Gen3Predictor if the logged-in user is also a player in the battle.
   * * `'spectating'` will only open the Gen3Predictor if the user is spectating a battle.
   * * `'never'` will completely disable the Gen3Predictor.
   *
   * @default 'always'
   * @since 1.2.6
   */
  openOnStart: 'always' | 'playing' | 'spectating' | 'never';

  /**
   * How the Gen3Predictor should open when opened.
   *
   * * `'panel'` (default) will open the Gen3Predictor in its own panel tab.
   * * `'overlay'` will open the Gen3Predictor as an overlay over the battle chat.
   *   - In this mode, a button will be added next to the battle timer to open the Gen3Predictor.
   *
   * @default 'panel'
   * @since 1.2.6
   */
  openAs: CalcdexRenderMode;

  /**
   * How the Gen3Predictor panel tab automatically closes.
   *
   * * `'battle-end'` will close the Gen3Predictor panel tab when the battle ends.
   * * `'battle-tab'` will close the Gen3Predictor panel tab when the user closes the battle tab.
   * * `'never'` refers to the automatic closing mechanism.
   * * Has no effect if `openAs` is `'overlay'`.
   *
   * @default 'battle-tab'
   * @since 1.2.6
   */
  closeOn: 'battle-end' | 'battle-tab' | 'never';

  /**
   * Whether the Gen3Predictor should be destroyed from the Redux state when the panel tab is closed.
   *
   * * If `true`, Gen3Predictor won't be able to be reopened once closed.
   * * Has no effect if `openAs` is `'overlay'`.
   *
   * @default true
   * @since 1.2.6
   */
  destroyOnClose: boolean;
}
