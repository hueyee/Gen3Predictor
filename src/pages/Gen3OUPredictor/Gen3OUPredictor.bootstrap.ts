import * as ReactDOM from 'react-dom/client';
import { type ShowdexBootstrapper } from '@showdex/interfaces/app';
import { type ShowdexSliceState } from '@showdex/redux/store';
import { createGen3OUPredictorRoom, tRef } from '@showdex/utils/app';
import { logger } from '@showdex/utils/debug';
import { detectGenFromFormat } from '@showdex/utils/dex';
import { getBattleRoom } from '@showdex/utils/host';
import { Gen3OUPredictorRenderer } from './Gen3OUPredictor.renderer';

const l = logger('@showdex/pages/Gen3OUPredictor/Gen3OUPredictorBootstrapper()');

export const Gen3OUPredictorBootstrapper: ShowdexBootstrapper = (
  store,
  data,
  roomid,
) => {
  if (!roomid?.startsWith?.('battle-')) {
    return;
  }

  const battleRoom = getBattleRoom(roomid);
  const battle = battleRoom?.battle;

  if (!battle?.id) {
    l.debug('No battle ID found; skipping Gen3OUPredictor bootstrap.');
    return;
  }

  const format = battle.id.split('-').find((p) => detectGenFromFormat(p));
  if (!/gen3ou/i.test(format)) {
    l.debug('Format is not Gen3OU; skipping Gen3OUPredictor.');
    return;
  }

  // Don't process if we've already initialized
  if (battle.gen3ouPredictorInit) {
    return;
  }

  const gen3predictorSettings = (store.getState()?.showdex as ShowdexSliceState)?.settings?.gen3predictor;

  // Check if we should initialize based on openOnStart setting
  if (['playing', 'spectating', 'never'].includes(gen3predictorSettings?.openOnStart)) {
    // For now, we don't have auth player detection for Gen3Predictor
    // so we'll just skip for 'never'
    if (gen3predictorSettings.openOnStart === 'never') {
      return;
    }
  }

  const openAsPanel = !gen3predictorSettings?.openAs || gen3predictorSettings.openAs === 'panel';

  if (openAsPanel) {
    // Create the Gen3Predictor panel room
    if (!battle.gen3ouPredictorRoom) {
      battle.gen3ouPredictorRoom = createGen3OUPredictorRoom(battle.id, store, true);
    }

    if (!battle.gen3ouPredictorRoom) {
      l.error('Failed to create Gen3OUPredictorRoom.');
      return;
    }

    Gen3OUPredictorRenderer(
      battle.gen3ouPredictorRoom.reactRoot,
      store,
      battle.id,
      battleRoom,
    );
  } else {
    // Opening as overlay
    const $el = $(battleRoom.el);
    const $controls = $el.find('div.battle-controls');
    const $chatFrame = $el.find('div.battle-log');

    const injectToggleButton = () => {
      if (typeof $controls?.find !== 'function') {
        return;
      }

      const visible = !!battle.gen3ouPredictorOverlayVisible;
      const toggleButtonIcon = visible ? 'close' : 'chart-line';
      const toggleButtonLabel = `${visible ? 'Close' : 'Open'} Gen3 Predictor`;

      const $existingToggleButton = $controls.find('button[name*="toggleGen3PredictorOverlay"]');
      const hasExistingToggleButton = !!$existingToggleButton.length;

      const $toggleButton = hasExistingToggleButton ? $existingToggleButton : $(`
        <button
          class="button"
          style="float: right;"
          type="button"
          name="toggleGen3PredictorOverlay"
        >
          <i class="fa fa-${toggleButtonIcon}"></i>
          <span>${toggleButtonLabel}</span>
        </button>
      `);

      if (hasExistingToggleButton) {
        $toggleButton.children('i.fa').attr('class', `fa fa-${toggleButtonIcon}`);
        $toggleButton.children('span').text(toggleButtonLabel);
      }

      const $floatingContainer = $controls.find('div.controls span[style*="float:"]');

      if ($floatingContainer.length) {
        $floatingContainer.css('text-align', 'right');
        $toggleButton.css('float', '');
      }

      const $waitingContainer = $controls.find('div.controls > p:first-of-type');
      const $whatDoContainer = $controls.find('div.controls > div.whatdo');

      const $controlsContainer = $floatingContainer.length
        ? $floatingContainer
        : $waitingContainer.length
          ? $waitingContainer
          : $whatDoContainer;

      $toggleButton.css('margin-right', 7);

      if (hasExistingToggleButton) {
        return;
      }

      const $controlsTarget = $controlsContainer.length
        ? $controlsContainer
        : $controls;

      const $timerButton = $controlsTarget.find('button[name*="Timer"]');
      const hasTimerButton = !!$timerButton.length;

      if (hasTimerButton) {
        $toggleButton.insertAfter($timerButton);
      } else {
        $controlsTarget[hasTimerButton ? 'append' : 'prepend']($toggleButton);
      }
    };

    // Override control rendering functions to inject the toggle button
    const overrides: { name: string; native: (...args: unknown[]) => void }[] = [];

    [
      'updateControls',
      'updateControlsForPlayer',
    ].forEach((name: string) => {
      if (typeof battleRoom[name] !== 'function') {
        return;
      }

      const native = battleRoom[name].bind(battleRoom);
      overrides.push({ name, native });

      battleRoom[name] = (
        ...args: unknown[]
      ) => {
        native(...args);
        injectToggleButton();
      };
    });

    // Create the overlay container
    const $rootContainer = $('<div></div>');
    $rootContainer.css('display', 'none');

    battleRoom.toggleGen3PredictorOverlay = () => {
      const visible = !battle.gen3ouPredictorOverlayVisible;
      battle.gen3ouPredictorOverlayVisible = visible;

      const battleRoomStyles: React.CSSProperties = {
        visibility: visible ? 'hidden' : 'visible',
        opacity: visible ? 0 : 1,
      };

      $rootContainer.css('display', visible ? 'flex' : 'none');
      $chatFrame.css('opacity', battleRoomStyles.opacity);

      if (battleRoom.$chatbox?.length) {
        battleRoom.$chatbox.prop('disabled', visible);
      }

      if (battleRoom.$chatAdd?.length) {
        const $joinButton = battleRoom.$chatAdd.find('button');
        if ($joinButton.length) {
          $joinButton.prop('disabled', visible);
        }
      }

      battleRoom.updateControls();
    };

    $rootContainer.css({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 100,
      display: 'none',
      flexFlow: 'column nowrap',
      backgroundColor: 'var(--color-bg)',
    });

    $el.css('position', 'relative');
    $el.append($rootContainer);

    // Create React root for the overlay
    if (!battle.gen3ouPredictorReactRoot) {
      battle.gen3ouPredictorReactRoot = ReactDOM.createRoot($rootContainer[0]);
    }

    Gen3OUPredictorRenderer(
      battle.gen3ouPredictorReactRoot,
      store,
      battle.id,
      battleRoom,
    );

    injectToggleButton();
  }

  battle.gen3ouPredictorInit = true;
};
