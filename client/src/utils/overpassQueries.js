export function buildRoadsQuery(bbox) {
  const { south, west, north, east } = bbox;
  return `[out:json][timeout:30];
(
  way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|service"]
  (${south},${west},${north},${east});
);
out geom;`;
}

export function buildWaterQuery(bbox) {
  const { south, west, north, east } = bbox;
  return `[out:json][timeout:30];
(
  way["natural"="water"](${south},${west},${north},${east});
  relation["natural"="water"](${south},${west},${north},${east});
  way["waterway"~"riverbank|dock"](${south},${west},${north},${east});
  way["landuse"="reservoir"](${south},${west},${north},${east});
);
out geom;`;
}

export function buildCoastlineQuery(bbox) {
  const { south, west, north, east } = bbox;
  return `[out:json][timeout:30];
(
  way["natural"="coastline"](${south},${west},${north},${east});
);
out geom;`;
}
