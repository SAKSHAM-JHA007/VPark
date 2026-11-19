# Maps in VPark

## Where maps appear

| Surface | When | Implementation |
| --- | --- | --- |
| Digital Pass (exact bay location) | After a booking is confirmed | `src/components/maps/PassLocationMap.tsx` |
| Driver search | Not shown | The pre-booking map was removed for privacy in `31bd006`. `InteractiveMap.tsx` is kept in the repo but is not rendered. |

## Two rendering modes

**1. Google Maps JavaScript API (preferred)**
Used when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set and Google accepts the key.

- The map follows the VPark theme. Light theme uses `LIGHT_MAP_STYLES`, dark theme uses `DARK_MAP_STYLES` (`src/components/maps/mapStyles.ts`).
- Theme changes are applied in place with `map.setOptions({ styles })`. The map is not re-created and the view is not reset.
- The script is loaded once per page by `src/components/maps/googleMapsLoader.ts` (`loading=async`, `importLibrary`; only `core`, `maps` and `marker`).
- No Map ID is used. Google ignores JSON `styles` on maps that have a Map ID, so combining the two would silently disable theming.
- Satellite imagery is never restyled.

**2. Keyless iframe fallback**
Used when no key is configured, the script fails to load, or Google rejects the key (`gm_authFailure`).

- Shows the standard Google Maps embed at the exact coordinates.
- **Limitation:** this embed cannot be styled and has no dark mode. VPark does not apply CSS inversion, grayscale or overlays to imitate one. In dark theme a short caption states that the map is shown in Google's standard light style.
- The keyed Maps Embed API has the same limitation, so a dark map always needs the JavaScript API.

## Configuring the key

1. In Google Cloud, enable **Maps JavaScript API** on a project with billing enabled.
2. Create an API key and restrict it:
   - **Application restriction:** HTTP referrers. Add the production domain (for example `https://vpark-one.vercel.app/*`) and `http://localhost:3000/*` for development. Avoid a blanket `*.vercel.app` pattern, because any Vercel app would match.
   - **API restriction:** Maps JavaScript API only.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local` (development) and in the hosting provider's environment settings (production). Never commit a real key.

`NEXT_PUBLIC_*` variables are bundled into client JavaScript, so the key is always visible in the browser. The referrer and API restrictions are what protect it.
