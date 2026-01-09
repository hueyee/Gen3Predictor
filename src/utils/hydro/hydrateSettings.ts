import {
  DefaultShowdexSettings,
  DehydratedCalcdexSettingsMap,
  DehydratedGen3PredictorSettingsMap,
  DehydratedShowdexSettingsMap,
  HydratedCalcdexSettingsMap,
  HydratedGen3PredictorSettingsMap,
  HydratedHellodexSettingsMap,
  HydratedHonkdexSettingsMap,
  HydratedShowdexSettingsMap,
  HydratedShowdownSettingsMap,
} from '@showdex/consts/hydro';
import { type ShowdexSettings, type ShowdexCalcdexSettings } from '@showdex/interfaces/app';
import { type CalcdexPlayerKey } from '@showdex/interfaces/calc';
import { logger } from '@showdex/utils/debug';
import { getColorScheme } from '@showdex/utils/host';
import { hydrateHeader } from './hydrateHeader';
import { hydrateArray, hydrateBoolean, hydrateValue } from './hydratePrimitives';

/**
 * Internally-used list of keys to ignore when hydrating the root `ShowdexSettings`.
 *
 * @since 1.0.3
 */
const IgnoredDehydratedShowdexKeys = [
  // DehydratedShowdexSettingsMap.packageVersion,
  // DehydratedShowdexSettingsMap.buildDate,
];

/**
 * Hydrates a string `value` into per-side settings.
 *
 * @since 1.0.3
 */
export const hydratePerSide = (
  value: string,
  delimiter = '/',
  arrayDelimiter = ',',
): Record<'auth' | CalcdexPlayerKey, unknown> => {
  const [
    auth,
    p1,
    p2,
    p3,
    p4,
  ] = value?.split(delimiter).map((v) => (
    v?.includes(arrayDelimiter)
      ? hydrateArray(v, arrayDelimiter)
      : hydrateBoolean(v)
  )) || [];

  return {
    auth,
    p1,
    p2,
    p3,
    p4,
  };
};

const l = logger('@showdex/utils/hydro/hydrateSettings()');

/**
 * Hydrates the passed-in dehydrated `settings`, typically for restoring settings stored in `LocalStorage`.
 *
 * * If `value` is falsy or improperly formatted, default settings will be returned.
 *
 * @since 1.0.3
 */
export const hydrateSettings = (
  value?: string,
): ShowdexSettings => {
  // these settings have their default values, which will be individually overwritten with the hydrated values
  // from the dehydrated settings in the passed-in `value` (otherwise, the default settings will be returned)
  // update (2023/12/31): there's a read-only error on Firefox, so need to spread out each object value .-.
  const settings: ShowdexSettings = {
    ...DefaultShowdexSettings,
    colorScheme: getColorScheme(),
    hellodex: { ...DefaultShowdexSettings.hellodex },
    calcdex: { ...DefaultShowdexSettings.calcdex },
    gen3predictor: { ...DefaultShowdexSettings.gen3predictor },
    honkdex: { ...DefaultShowdexSettings.honkdex },
    showdown: { ...DefaultShowdexSettings.showdown },
  };

  if (!value || typeof value !== 'string') {
    // l.silly(
    //   'No dehydrated settings string was provided, so returning default settings', settings,
    //   '\n', 'value', value, '(should be falsy)',
    // );

    return settings;
  }

  // const dehydratedSettings = value.split(';') || [];
  const [, dehydratedSettings] = hydrateHeader(value);

  if (!dehydratedSettings.length) {
    l.debug(
      'Dehydrated settings may be improperly formatted, so returning default settings', settings,
      '\n', 'dehydratedSettings', dehydratedSettings,
      '\n', 'value', value,
    );

    return settings;
  }

  dehydratedSettings.forEach((dehydratedSetting) => {
    const [
      rawDehydratedKey,
      dehydratedValue,
    ] = dehydratedSetting?.split(':') || [];

    const dehydratedKey = rawDehydratedKey?.toLowerCase();

    if (!dehydratedKey || IgnoredDehydratedShowdexKeys.includes(dehydratedKey)) {
      return;
    }

    switch (dehydratedKey) {
      case DehydratedShowdexSettingsMap.hellodex: {
        const dehydratedHellodexSettings = dehydratedValue?.split('|') || [];

        if (!dehydratedHellodexSettings.length) {
          break;
        }

        dehydratedHellodexSettings.forEach((dehydratedHellodexSetting) => {
          const [
            rawDehydratedHellodexKey,
            ...dehydratedHellodexValues
          ] = dehydratedHellodexSetting?.split('~') || [];

          const dehydratedHellodexKey = rawDehydratedHellodexKey?.toLowerCase();

          if (!dehydratedHellodexKey) {
            return;
          }

          const dehydratedHellodexValue = dehydratedHellodexValues.join('~');
          const hydratedHellodexKey = HydratedHellodexSettingsMap[dehydratedHellodexKey];

          if (!hydratedHellodexKey || !(hydratedHellodexKey in settings.hellodex)) {
            return;
          }

          // currently, only boolean values exist in ShowdexHellodexSettings
          settings.hellodex[hydratedHellodexKey] = ['y', 'n'].includes(dehydratedHellodexValue)
            ? hydrateBoolean(dehydratedHellodexValue)
            : null;
        });

        break;
      }

      case DehydratedShowdexSettingsMap.calcdex: {
        const dehydratedCalcdexSettings = dehydratedValue?.split('|') || [];

        if (!dehydratedCalcdexSettings.length) {
          break;
        }

        dehydratedCalcdexSettings.forEach((dehydratedCalcdexSetting) => {
          const [
            rawDehydratedCalcdexKey,
            ...dehydratedCalcdexValues
          ] = dehydratedCalcdexSetting?.split('~') || [];

          const dehydratedCalcdexKey = rawDehydratedCalcdexKey?.toLowerCase();

          if (!dehydratedCalcdexKey) {
            return;
          }

          const dehydratedCalcdexValue = dehydratedCalcdexValues.join('~');
          const hydratedCalcdexKey = HydratedCalcdexSettingsMap[dehydratedCalcdexKey];

          if (!hydratedCalcdexKey || !(hydratedCalcdexKey in settings.calcdex)) {
            return;
          }

          // thanks TypeScript!
          // (without this declaration, you'll get a type <type> is not assignable to type 'never' error lmfao)
          const calcdexSettings: Partial<Record<typeof hydratedCalcdexKey, ShowdexCalcdexSettings[typeof hydratedCalcdexKey]>> = settings.calcdex;

          calcdexSettings[hydratedCalcdexKey] = [
            DehydratedCalcdexSettingsMap.includePresetsBundles,
            DehydratedCalcdexSettingsMap.nhkoColors,
            DehydratedCalcdexSettingsMap.nhkoLabels,
          ].includes(dehydratedCalcdexKey)
            ? hydrateArray<Extract<ShowdexCalcdexSettings[typeof hydratedCalcdexKey], unknown[]>>(dehydratedCalcdexValue)
            : [
              DehydratedCalcdexSettingsMap.defaultAutoSelect,
              DehydratedCalcdexSettingsMap.defaultAutoPreset,
              DehydratedCalcdexSettingsMap.defaultAutoMoves,
              // DehydratedCalcdexSettingsMap.defaultShowGenetics,
              DehydratedCalcdexSettingsMap.lockGeneticsVisibility,
            ].includes(dehydratedCalcdexKey)
              ? hydratePerSide(dehydratedCalcdexValue) as ShowdexCalcdexSettings[typeof hydratedCalcdexKey]
              : hydrateValue(dehydratedCalcdexValue) as ShowdexCalcdexSettings[typeof hydratedCalcdexKey];
        });

        break;
      }

      case DehydratedShowdexSettingsMap.gen3predictor: {
        const dehydratedGen3PredictorSettings = dehydratedValue?.split('|') || [];

        if (!dehydratedGen3PredictorSettings.length) {
          break;
        }

        dehydratedGen3PredictorSettings.forEach((dehydratedGen3PredictorSetting) => {
          const [
            rawDehydratedGen3PredictorKey,
            ...dehydratedGen3PredictorValues
          ] = dehydratedGen3PredictorSetting?.split('~') || [];

          const dehydratedGen3PredictorKey = rawDehydratedGen3PredictorKey?.toLowerCase();

          if (!dehydratedGen3PredictorKey) {
            return;
          }

          const dehydratedGen3PredictorValue = dehydratedGen3PredictorValues.join('~');
          const hydratedGen3PredictorKey = HydratedGen3PredictorSettingsMap[dehydratedGen3PredictorKey];

          if (!hydratedGen3PredictorKey || !(hydratedGen3PredictorKey in settings.gen3predictor)) {
            return;
          }

          // Gen3Predictor settings include strings (openOnStart, openAs, closeOn) and booleans (destroyOnClose)
          settings.gen3predictor[hydratedGen3PredictorKey] = [
            DehydratedGen3PredictorSettingsMap.destroyOnClose,
          ].includes(dehydratedGen3PredictorKey)
            ? hydrateBoolean(dehydratedGen3PredictorValue)
            : hydrateValue(dehydratedGen3PredictorValue);
        });

        break;
      }

      case DehydratedShowdexSettingsMap.honkdex: {
        const dehydratedHonkdexSettings = dehydratedValue?.split('|') || [];

        if (!dehydratedHonkdexSettings.length) {
          break;
        }

        dehydratedHonkdexSettings.forEach((dehydratedHonkdexSetting) => {
          const [
            rawDehydratedHonkdexKey,
            ...dehydratedHonkdexValues
          ] = dehydratedHonkdexSetting?.split('~') || [];

          const dehydratedHonkdexKey = rawDehydratedHonkdexKey?.toLowerCase();

          if (!dehydratedHonkdexKey) {
            return;
          }

          const dehydratedHonkdexValue = dehydratedHonkdexValues.join('~');
          const hydratedHonkdexKey = HydratedHonkdexSettingsMap[dehydratedHonkdexKey];

          if (!hydratedHonkdexKey || !(hydratedHonkdexKey in settings.honkdex)) {
            return;
          }

          // currently, only boolean values exist in ShowdexHonkdexSettings
          settings.honkdex[hydratedHonkdexKey] = ['y', 'n'].includes(dehydratedHonkdexValue)
            ? hydrateBoolean(dehydratedHonkdexValue)
            : null;
        });

        break;
      }

      case DehydratedShowdexSettingsMap.showdown: {
        const dehydratedShowdownSettings = dehydratedValue?.split('|') || [];

        if (!dehydratedShowdownSettings.length) {
          break;
        }

        dehydratedShowdownSettings.forEach((dehydratedShowdownSetting) => {
          const [
            rawDehydratedShowdownKey,
            ...dehydratedShowdownValues
          ] = dehydratedShowdownSetting?.split('~') || [];

          const dehydratedShowdownKey = rawDehydratedShowdownKey?.toLowerCase();

          if (!dehydratedShowdownKey) {
            return;
          }

          const dehydratedShowdownValue = dehydratedShowdownValues.join('~');
          const hydratedShowdownKey = HydratedShowdownSettingsMap[dehydratedShowdownKey];

          if (!hydratedShowdownKey || !(hydratedShowdownKey in settings.showdown)) {
            return;
          }

          // currently, only boolean values exist in ShowdexShowdownSettings
          settings.showdown[hydratedShowdownKey] = ['y', 'n'].includes(dehydratedShowdownValue)
            ? hydrateBoolean(dehydratedShowdownValue)
            : null;
        });

        break;
      }

      default: {
        const hydratedKey = HydratedShowdexSettingsMap[dehydratedKey];

        if (!hydratedKey) {
          break;
        }

        /**
         * @todo remove this once developer features are added
         */
        if (hydratedKey === 'developerMode') {
          break;
        }

        settings[hydratedKey] = hydrateValue(dehydratedValue);

        break;
      }
    }
  });

  // some bandaid fixes cause I ended up changing the types of some old settings
  if (typeof settings.calcdex.includeTeambuilder === 'boolean') {
    settings.calcdex.includeTeambuilder = settings.calcdex.includeTeambuilder
      ? 'always' // true
      : 'never'; // false
  }

  return settings;
};
