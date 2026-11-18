/**
 * Field values the shadowrun6-eden Foundry system (4.x) uses: skill specialization ids by skill, and
 * the gear type and subtype for each group in our catalog. Ids and English labels only.
 */

/** Specialization ids per skill, with the system's English label. */
export const EDEN_SPECS: Record<string, Record<string, string>> = {
  "astral": {
    "astral_combat": "Astral Combat",
    "astral_signatures": "Astral Signatures",
    "emotional_stress": "Emotional Stress",
    "spirit_types": "Spirit Types"
  },
  "athletics": {
    "climbing": "Climbing",
    "flying": "Flying",
    "free_fall": "Free Fall",
    "gymnastics": "Gymnastics",
    "sprinting": "Sprinting",
    "swimming": "Swimming",
    "throwing": "Throwing",
    "archery": "Archery"
  },
  "biotech": {
    "biotechnology": "Biotechnology",
    "cybertechnology": "Cybertechnology",
    "first_aid": "First Aid",
    "medicine": "Medicine"
  },
  "close_combat": {
    "blades": "Blades",
    "clubs": "Clubs",
    "unarmed": "Unarmed Combat"
  },
  "con": {
    "acting": "Acting",
    "disguise": "Disguise",
    "impersonation": "Impersonation",
    "performance": "Performance"
  },
  "conjuring": {
    "banishing": "Banishing",
    "summoning": "Summoning"
  },
  "cracking": {
    "cybercombat": "Cybercombat",
    "hacking": "Hacking"
  },
  "electronics": {
    "computer": "Computer",
    "hardware": "Hardware",
    "software": "Software",
    "complex_forms": "Complex Forms"
  },
  "enchanting": {
    "alchemy": "Alchemy",
    "artificing": "Artificing",
    "disenchanting": "Disenchanting"
  },
  "engineering": {
    "armorer": "Armorer",
    "demolitions": "Demolitions",
    "gunnery": "Gunnery",
    "lockpicking": "Lockpicking"
  },
  "exotic_weapons": {
    "chainsaws": "Chainsaws",
    "brawling": "Close Combat",
    "air": "Compressed Air",
    "emitter": "Energy Weapons",
    "laser": "Laser Weapons",
    "launchers": "Launchers",
    "spray": "Spray Weapons",
    "whips": "Whips",
    "other": "Other"
  },
  "firearms": {
    "tasers": "Taser",
    "holdouts": "Holdouts",
    "pistols_light": "Light Pistols",
    "pistols_heavy": "Heavy Pistols",
    "machine_pistols": "Machine Pistols",
    "machine_guns": "Machine Guns",
    "submachine_guns": "Submachine Guns",
    "rifles": "Rifles",
    "shotguns": "Shotguns",
    "assault_cannons": "Assault Cannons"
  },
  "influence": {
    "etiquette": "Etiquette",
    "instruction": "Instruction",
    "intimidation": "Intimidation",
    "leadership": "Leadership",
    "negotiation": "Negotiation"
  },
  "outdoors": {
    "navigation": "Navigation",
    "survival": "Survival",
    "tracking": "Tracking",
    "tracking_woods": "Environment Woods",
    "tracking_desert": "Environment Desert",
    "tracking_urban": "Environment Urban",
    "tracking_other": "Environment Other"
  },
  "perception": {
    "visual": "Visual",
    "aural": "Aural",
    "tactile": "Tactile",
    "scent": "Scent",
    "taste": "Taste",
    "perception_woods": "Environment Woods",
    "perception_urban": "Environment Urban",
    "perception_other": "Environment Other"
  },
  "piloting": {
    "ground_craft": "Ground Craft",
    "aircraft": "Aircraft",
    "watercraft": "Watercraft"
  },
  "sorcery": {
    "counterspelling": "Counterspelling",
    "spellcasting": "Spellcasting"
  },
  "stealth": {
    "disguise": "Disguise",
    "palming": "Palming",
    "sneaking": "Sneaking",
    "camouflage": "Camouflage"
  },
  "tasking": {
    "compiling": "Compiling",
    "decompiling": "Decompiling",
    "registering": "Registering"
  }
};

/** Catalog group to [gear type, subtype]. */
export const EDEN_GEAR: Record<string, [string, string]> = {
  "Regular ammo": ["AMMUNITION", "AMMUNITION"], "APDS ammo": ["AMMUNITION", "AMMUNITION"], "Explosive ammo": ["AMMUNITION", "AMMUNITION"],
  "Flechette ammo": ["AMMUNITION", "AMMUNITION"], "Gel ammo": ["AMMUNITION", "AMMUNITION"], "Stick-n-Shock ammo": ["AMMUNITION", "AMMUNITION"],
  "Arrows and bolts": ["AMMUNITION", "BOWS"], "Explosives": ["AMMUNITION", "EXPLOSIVES"], "Grenade": ["AMMUNITION", "GRENADES"],
  "Rocket and missile": ["AMMUNITION", "ROCKETS"],
  "Armor": ["ARMOR", "ARMOR_BODY"], "Helmet and shield": ["ARMOR", "ARMOR_HELMET"], "Clothing": ["ARMOR", "ARMOR_CLOTHES"],
  "Armor modification": ["ARMOR_ADDITION", ""],
  "Bioware": ["BIOWARE", "BIOWARE_STANDARD"], "Cultured bioware": ["BIOWARE", "BIOWARE_CULTURED"],
  "Bodyware": ["CYBERWARE", "CYBER_BODYWARE"], "Cyberlimb": ["CYBERWARE", "CYBER_LIMBS"], "Cyberlimb accessory": ["CYBERWARE", "CYBER_LIMBS"],
  "Earware": ["CYBERWARE", "CYBER_EARWARE"], "Eyeware": ["CYBERWARE", "CYBER_EYEWARE"], "Headware": ["CYBERWARE", "CYBER_HEADWARE"],
  "Implant weapon": ["CYBERWARE", "CYBER_IMPLANT_WEAPON"],
  "Microdrone": ["DRONES", "MICRODRONES"], "Minidrone": ["DRONES", "MINIDRONES"], "Small drone": ["DRONES", "SMALL_DRONES"],
  "Medium drone": ["DRONES", "MEDIUM_DRONES"], "Large drone": ["DRONES", "LARGE_DRONES"],
  "Accessory": ["ELECTRONICS", "ELECTRONIC_ACCESSORIES"], "Audio device": ["ELECTRONICS", "AUDIO"], "Audio enhancement": ["ELECTRONICS", "AUDIO"],
  "Communications": ["ELECTRONICS", "COMMUNICATION"], "Optical device": ["ELECTRONICS", "OPTICAL"], "Visual enhancement": ["ELECTRONICS", "OPTICAL"],
  "RFID tag": ["ELECTRONICS", "RFID"], "Sensor": ["ELECTRONICS", "SENSOR_HOUSING"], "Sensor housing": ["ELECTRONICS", "SENSOR_HOUSING"],
  "Credstick": ["ELECTRONICS", "ID_CREDIT"], "DocWagon": ["ELECTRONICS", "ID_CREDIT"], "Fake ID": ["ELECTRONICS", "ID_CREDIT"],
  "Focus": ["MAGICAL", "MAGIC_SUPPLIES"], "Spell formula": ["MAGICAL", "MAGICAL_FORMULA"], "Supplies": ["MAGICAL", "MAGIC_SUPPLIES"],
  "Commlink": ["ELECTRONICS", "COMMLINK"], "Cyberdeck": ["ELECTRONICS", "CYBERDECK"], "Rigger console": ["ELECTRONICS", "RIGGER_CONSOLE"],
  "Skillsoft": ["SOFTWARE", "SKILLSOFT"], "Software": ["SOFTWARE", "OTHER_PROGRAMS"],
  "Biotech": ["BIOLOGY", "BIOTECH"], "Slap patch": ["BIOLOGY", "SLAP_PATCHES"], "Breaking and entering": ["ELECTRONICS", "BREAKING"],
  "Security": ["ELECTRONICS", "SECURITY"], "Restraints": ["ELECTRONICS", "SECURITY"], "Chemicals": ["CHEMICALS", "INDUSTRIAL_CHEMICALS"],
  "Drug": ["CHEMICALS", "DRUGS"], "Toxin": ["CHEMICALS", "TOXINS"], "Climbing": ["SURVIVAL", "SURVIVAL_GEAR"], "Survival": ["SURVIVAL", "SURVIVAL_GEAR"],
  "Tools": ["TOOLS", "TOOLS"],
  "Bike": ["VEHICLES", "BIKES"], "Boat": ["VEHICLES", "BOATS"], "Car": ["VEHICLES", "CARS"], "Fixed-wing aircraft": ["VEHICLES", "FIXED_WING"],
  "Rotorcraft": ["VEHICLES", "ROTORCRAFT"], "Submarine": ["VEHICLES", "SUBMARINES"], "Truck and van": ["VEHICLES", "TRUCKS"], "VTOL/VSTOL": ["VEHICLES", "VTOL"],
  "Vehicle modification": ["ACCESSORY", "ACCESSORY"], "Weapon accessory": ["ACCESSORY", "ACCESSORY"],
  "Assault Cannon": ["WEAPON_FIREARMS", "ASSAULT_CANNON"], "Heavy Pistol": ["WEAPON_FIREARMS", "PISTOLS_HEAVY"], "Hold-out": ["WEAPON_FIREARMS", "HOLDOUTS"],
  "Light Pistol": ["WEAPON_FIREARMS", "PISTOLS_LIGHT"], "Machine Gun": ["WEAPON_FIREARMS", "LMG"], "Machine Pistol": ["WEAPON_FIREARMS", "MACHINE_PISTOLS"],
  "Rifle": ["WEAPON_FIREARMS", "RIFLE_ASSAULT"], "Shotgun": ["WEAPON_FIREARMS", "SHOTGUNS"], "Submachine Gun": ["WEAPON_FIREARMS", "SUBMACHINE_GUNS"],
  "Taser": ["WEAPON_FIREARMS", "TASERS"], "Blade": ["WEAPON_CLOSE_COMBAT", "BLADES"], "Club": ["WEAPON_CLOSE_COMBAT", "CLUBS"],
  "Unarmed": ["WEAPON_CLOSE_COMBAT", "UNARMED"], "Whip": ["WEAPON_CLOSE_COMBAT", "WHIPS"], "Bow and crossbow": ["WEAPON_RANGED", "BOWS"],
  "Throwing weapon": ["WEAPON_RANGED", "THROWING"], "Launcher": ["WEAPON_SPECIAL", "LAUNCHERS"], "DMSO": ["WEAPON_SPECIAL", "DMSO"], "Dart Gun": ["WEAPON_SPECIAL", "DART"],
};

/** The weapon specialization each weapon subtype is rolled with. */
export const EDEN_WEAPON_SPEC: Record<string, [skill: string, spec: string]> = {
  BLADES: ["close_combat", "blades"], CLUBS: ["close_combat", "clubs"], UNARMED: ["close_combat", "unarmed"], WHIPS: ["exotic_weapons", "whips"],
  TASERS: ["firearms", "tasers"], HOLDOUTS: ["firearms", "holdouts"], PISTOLS_LIGHT: ["firearms", "pistols_light"], PISTOLS_HEAVY: ["firearms", "pistols_heavy"],
  MACHINE_PISTOLS: ["firearms", "machine_pistols"], SUBMACHINE_GUNS: ["firearms", "submachine_guns"], SHOTGUNS: ["firearms", "shotguns"],
  RIFLE_ASSAULT: ["firearms", "rifles"], RIFLE_HUNTING: ["firearms", "rifles"], RIFLE_SNIPER: ["firearms", "rifles"],
  LMG: ["firearms", "machine_guns"], MMG: ["firearms", "machine_guns"], HMG: ["firearms", "machine_guns"], ASSAULT_CANNON: ["firearms", "assault_cannons"],
  BOWS: ["athletics", "archery"], CROSSBOWS: ["athletics", "archery"], THROWING: ["athletics", "throwing"],
  LAUNCHERS: ["exotic_weapons", "launchers"],
};
