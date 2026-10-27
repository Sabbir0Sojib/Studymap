declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson';
  const shp: (data: ArrayBuffer | string) => Promise<FeatureCollection | FeatureCollection[]>;
  export default shp;
}
