import { updateIds } from "./id";

export const getArmyData = ({ data, armyComposition }) => {
  // Remove units that don't belong to the army composition
  const characters = data.characters.filter(
    (unit) =>
      (unit?.armyComposition && unit.armyComposition[armyComposition]) ||
      !unit.armyComposition
  );
  const core = data.core.filter(
    (unit) =>
      (unit?.armyComposition && unit.armyComposition[armyComposition]) ||
      !unit.armyComposition
  );
  const special = data.special.filter(
    (unit) =>
      (unit?.armyComposition && unit.armyComposition[armyComposition]) ||
      !unit.armyComposition
  );
  const rare = data.rare.filter(
    (unit) =>
      (unit?.armyComposition && unit.armyComposition[armyComposition]) ||
      !unit.armyComposition
  );

  // Get units moving category
  const specialToCore = special.filter(
    (unit) =>
      unit?.armyComposition &&
      unit.armyComposition[armyComposition].category === "core"
  );
  const rareToCore = rare.filter(
    (unit) =>
      unit?.armyComposition &&
      unit.armyComposition[armyComposition].category === "core"
  );
  const rareToSpecial = rare.filter(
    (unit) =>
      unit?.armyComposition &&
      unit.armyComposition[armyComposition].category === "special"
  );
  const coreToSpecial = core.filter(
    (unit) =>
      unit?.armyComposition &&
      unit.armyComposition[armyComposition].category === "special"
  );
  const coreToRare = core.filter(
    (unit) =>
      unit?.armyComposition &&
      unit.armyComposition[armyComposition].category === "rare"
  );
  const specialToRare = special.filter(
    (unit) =>
      unit?.armyComposition &&
      unit.armyComposition[armyComposition].category === "rare"
  );
  const charactersToRare = characters?.length
    ? characters.filter(
        (unit) =>
          unit?.armyComposition &&
          unit.armyComposition[armyComposition].category === "rare"
      )
    : [];

  // Remove units from old category
  const allCore = [...core, ...specialToCore, ...rareToCore].filter(
    (unit) =>
      (unit?.armyComposition &&
        unit.armyComposition[armyComposition].category === "core") ||
      !unit.armyComposition
  );
  const allSpecial = [...special, ...coreToSpecial, ...rareToSpecial].filter(
    (unit) =>
      (unit?.armyComposition &&
        unit.armyComposition[armyComposition].category === "special") ||
      !unit.armyComposition
  );
  const allRare = [
    ...rare,
    ...specialToRare,
    ...charactersToRare,
    ...coreToRare,
  ].filter(
    (unit) =>
      (unit?.armyComposition &&
        unit.armyComposition[armyComposition].category === "rare") ||
      !unit.armyComposition
  );
  const allCharacters = [...characters].filter(
    (unit) =>
      (unit?.armyComposition &&
        unit.armyComposition[armyComposition].category === "characters") ||
      !unit.armyComposition
  );

  return {
    lords: updateIds(data.lords),
    heroes: updateIds(data.heroes),
    characters: updateIds(allCharacters),
    core: updateIds(allCore),
    special: updateIds(allSpecial),
    rare: updateIds(allRare),
    // mercenaries in some datasets are keyed by armyComposition (object of arrays)
    // keep mapping shape when present, but ensure inner arrays have ids updated
    mercenaries: (function () {
      if (!data.mercenaries) return {};
      if (Array.isArray(data.mercenaries)) return updateIds(data.mercenaries);
      const mapped = {};
      for (const k of Object.keys(data.mercenaries)) {
        mapped[k] = updateIds(data.mercenaries[k] || []);
      }
      return mapped;
    })(),
    // allies: normalize to an object keyed by armyComposition -> array of descriptors
    // We intentionally always return an object mapping composition -> array so callers
    // can reliably pick options for any composition. Do not preserve legacy array shape.
    allies: (function () {
      if (!data.allies) return {};
      // If allies is already an object keyed by composition, normalize each inner array
      if (!Array.isArray(data.allies)) {
        const mapped = {};
        for (const comp of Object.keys(data.allies)) {
          mapped[comp] = updateIds(data.allies[comp] || []);
        }
        return mapped;
      }

      // If allies is an array of descriptors, expand it into a mapping for every
      // composition listed on the army dataset. We will place the array under the
      // default composition id (each army may declare multiple compositions).
      const mapped = {};
      const comps = data.armyComposition || [];
      // If no compositions are declared, use a fallback key of the army id
      const fallback = comps.length ? comps[0] : data.id;
      // Use the provided compositions (if any) to index the allies array. If the
      // dataset has multiple compositions, apply the same allies array to each one.
      const targetComps = comps.length ? comps : [fallback];
      for (const comp of targetComps) mapped[comp] = updateIds(data.allies);
      return mapped;
    })(),
  };
};

// Normalize allies descriptors for an army dataset so callers can iterate a consistent
// array of ally descriptors: { army, armyComposition, magicItemsArmy }
export const getAvailableAllies = ({ data } = {}) => {
  if (!data || !data.allies) return [];
  // If allies is already an array of descriptors, normalize fields
  if (Array.isArray(data.allies)) {
    return data.allies.map((a) => ({
      army: a.army,
      armyComposition: a.armyComposition || a.army,
      magicItemsArmy: a.magicItemsArmy,
    }));
  }

  // If allies is an object keyed by composition, convert to descriptor list
  const out = [];
  for (const comp of Object.keys(data.allies)) {
    const arr = data.allies[comp] || [];
    if (arr.length === 0) continue;
    // if entries look like descriptors (have army field), map them
    if (arr[0] && typeof arr[0] === "object" && arr[0].army) {
      arr.forEach((a) => out.push({ army: a.army, armyComposition: a.armyComposition || comp, magicItemsArmy: a.magicItemsArmy }));
    } else {
      // otherwise treat the key as an army id and emit a single descriptor
      out.push({ army: comp, armyComposition: comp });
    }
  }
  return out;
};

// Return allies descriptors for a specific army composition.
// This is the strict, composition-keyed lookup the UI should use when
// presenting ally options for a particular list composition.
export const getAlliesForComposition = ({ data, composition } = {}) => {
  if (!data || !data.allies) return [];

  // If allies is an object keyed by composition, use the requested key.
  if (!Array.isArray(data.allies)) {
    const arr = data.allies[composition] || [];
    const out = [];
    for (const entry of arr) {
      if (entry && typeof entry === "object" && entry.army) {
        out.push({
          army: entry.army,
          // preserve entry.armyComposition only if the dataset explicitly provides it
          armyComposition: entry.armyComposition || undefined,
          magicItemsArmy: entry.magicItemsArmy,
        });
      } else if (typeof entry === "string") {
        out.push({ army: entry, armyComposition: undefined });
      }
    }
    return out;
  }

  // If allies is a legacy array, treat it as applicable to the requested
  // composition (fallback behavior).
  return data.allies.map((a) => ({
    army: a.army || a,
    // only preserve armyComposition when the source provides it
    armyComposition: a.armyComposition || undefined,
    magicItemsArmy: a.magicItemsArmy,
  }));
};
