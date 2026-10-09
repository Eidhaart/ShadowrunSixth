export type IcKind = "damage" | "drain" | "lock" | "scout";

export interface IcDef {
  name: string;
  kind: IcKind;
  defense: string;
  effect: string;
  threat: 1 | 2 | 3 | 4 | 5;
  tip: string;
}

export const IC_KIND: Record<IcKind, string> = {
  damage: "Hurts you or your deck",
  drain: "Weakens your stats",
  lock: "Traps or disrupts you",
  scout: "Finds you",
};

export const IC_LIST: IcDef[] = [
  { name: "Patrol", kind: "scout", defense: "None (it only looks)", effect: "Wanders the host making a Matrix Perception check every minute. It never fights, it just tells the owners you are there.", threat: 1, tip: "Hide, run silent, or keep your Sleaze up. Being spotted is what launches the rest." },
  { name: "Track", kind: "scout", defense: "Willpower + Sleaze", effect: "If it hits you, it learns where your body is.", threat: 3, tip: "Keep Sleaze high and do not let it connect. A traced hacker gets visitors." },
  { name: "Killer", kind: "damage", defense: "Intuition + Firewall", effect: "Straight Matrix damage: host rating plus net hits, against your deck.", threat: 3, tip: "Raise Firewall to soak it, or use Full Matrix Defense. Your deck can take a few hits." },
  { name: "Sparky", kind: "damage", defense: "Intuition + Firewall", effect: "Biofeedback damage: host rating plus net hits, straight into your body. It skips the deck entirely.", threat: 4, tip: "Willpower resists it, and cold-sim is the safer mode to be in. Seriously consider leaving." },
  { name: "Black IC", kind: "damage", defense: "Intuition + Firewall", effect: "Does host rating plus net hits as Matrix damage and as biofeedback damage, both at once.", threat: 5, tip: "This is the one that kills hackers. If you see it coming, you leave." },
  { name: "Blaster", kind: "lock", defense: "Logic + Firewall", effect: "Matrix damage equal to the host rating, and it link-locks you.", threat: 4, tip: "A locked connection means a Jack Out test and probable dumpshock. Do not be in VR when it arrives." },
  { name: "Tar Baby", kind: "lock", defense: "Logic + Firewall", effect: "No damage, but it link-locks you so you cannot log off the easy way.", threat: 3, tip: "It exists to hold you while the other IC arrive. Win the Jack Out test early." },
  { name: "Scramble", kind: "lock", defense: "Willpower + Firewall", effect: "If it hits, you are forced to reboot on your next turn, unless you are link-locked.", threat: 3, tip: "A reboot throws you out and costs you your access and bonus Edge." },
  { name: "Crash", kind: "lock", defense: "Intuition + Firewall", effect: "Does no damage but crashes one random running program until you reboot.", threat: 2, tip: "A crashed Overclock at a bad moment hurts. Do not stack all your hopes on one program." },
  { name: "Acid", kind: "drain", defense: "Willpower + Firewall", effect: "Each net hit lowers your Firewall by 1. You recover 1 point per minute after leaving the host.", threat: 3, tip: "Pairs with damage IC: your defense melts first, then you get hit." },
  { name: "Binder", kind: "drain", defense: "Willpower + Data Processing", effect: "Each net hit lowers your Data Processing by 1. At 0 you cannot take Matrix actions at all.", threat: 3, tip: "Cripples your programs and your Defense Rating. Do not wait around." },
  { name: "Jammer", kind: "drain", defense: "Willpower + Attack", effect: "Each net hit lowers your Attack by 1. At 0 you cannot use Attack-based actions.", threat: 2, tip: "Hurts brute-force builds most. Sleaze hackers barely notice." },
  { name: "Marker", kind: "drain", defense: "Willpower + Sleaze", effect: "Each net hit lowers your Sleaze by 1. At 0 you cannot use Sleaze-based actions.", threat: 2, tip: "Exists to stop hackers who rely on backdoors. Keep an Attack option in your pocket." },
];

export type Goal = "in" | "data" | "control" | "hide" | "fight" | "out" | "learn";

export const GOALS: { id: Goal; label: string }[] = [
  { id: "learn", label: "Learn about a target" },
  { id: "in", label: "Get in" },
  { id: "data", label: "Find or steal data" },
  { id: "control", label: "Take control of stuff" },
  { id: "hide", label: "Stay unseen" },
  { id: "fight", label: "Fight or disrupt" },
  { id: "out", label: "Get out" },
];

export interface ActionDef {
  name: string;
  goals: Goal[];
  legal: boolean;
  access: string;
  test: string;
  kind: "Major" | "Minor" | "Extended";
  plain: string;
  watch: string;
}

export const ACTIONS: ActionDef[] = [
  { name: "Matrix Search", goals: ["learn"], legal: true, access: "Any", test: "Electronics + Intuition, extended (10 min)", kind: "Extended", plain: "Look something up in public data. More hits, more useful results.", watch: "It is slow. Do it before the run, not during." },
  { name: "Matrix Perception", goals: ["learn", "hide"], legal: true, access: "Any", test: "Electronics + Intuition vs Willpower + Sleaze", kind: "Minor", plain: "Look at an icon or hunt for one that is running silent. One net hit gives basic info, two give attribute ratings and running programs. Minor action if you have a deck, cyberjack or Resonance.", watch: "A tie only lets you see the icon." },
  { name: "Probe", goals: ["in"], legal: false, access: "Any", test: "Cracking + Logic vs Willpower + Firewall (or Firewall x 2), extended, 1 minute", kind: "Extended", plain: "Quietly look for a weakness and make a backdoor.", watch: "Slow. A glitch can set off an alarm. Sleaze-linked." },
  { name: "Backdoor Entry", goals: ["in"], legal: false, access: "Any", test: "Cracking + Logic vs Willpower + Firewall", kind: "Major", plain: "Use a backdoor you made with Probe. Net hits from the Probe add dice. You get Admin access that does not count as illegal Admin.", watch: "If it fails the backdoor is gone. Sleaze-linked." },
  { name: "Brute Force", goals: ["in"], legal: false, access: "Any", test: "Cracking + Logic vs Willpower + Firewall", kind: "Major", plain: "Smash your way to User or Admin access fast.", watch: "Always alerts the target. Attack-linked. Straight to Admin is harder." },
  { name: "Hash Check", goals: ["data"], legal: false, access: "User / Admin", test: "Electronics + Logic, threshold 1 with a hash, 4 without", kind: "Major", plain: "Find an encrypted file without decrypting everything. Meeting the threshold narrows it to 32 candidates, and every net hit halves that.", watch: "Repeats cost a minus 2 dice penalty." },
  { name: "Crack File", goals: ["data"], legal: false, access: "User / Admin", test: "Cracking + Logic vs Encryption Rating x 2", kind: "Major", plain: "Remove encryption so a file becomes readable.", watch: "The decryption program gives plus 2 dice." },
  { name: "Edit File", goals: ["data", "hide"], legal: true, access: "User / Admin", test: "Electronics + Logic vs Intuition + Firewall or Firewall + Sleaze", kind: "Major", plain: "Create, change, copy, delete or protect a file, one detail per action. Also how you loop a video feed.", watch: "A continuous edit needs one roll every round. Copying a file with a Data Bomb sets it off on you." },
  { name: "Set Data Bomb", goals: ["data", "fight"], legal: false, access: "Admin", test: "Electronics + Logic vs Device Rating x 2", kind: "Major", plain: "Booby-trap a file. Whoever touches it without the passcode takes 2x rating Matrix damage.", watch: "One bomb per file." },
  { name: "Disarm Data Bomb", goals: ["data"], legal: true, access: "User / Admin", test: "Cracking + Logic vs Data Bomb Rating x 2", kind: "Major", plain: "Defuse a bomb you found with Matrix Perception.", watch: "Zero net hits and it goes off." },
  { name: "Control Device", goals: ["control"], legal: true, access: "User / Admin", test: "Electronics + Logic vs Willpower + Firewall", kind: "Major", plain: "Use a device remotely as if you owned it: doors, cameras, drones. Admin access lets you switch it off.", watch: "Fails against a drone a rigger has jumped into." },
  { name: "Spoof Command", goals: ["control"], legal: false, access: "Any", test: "Cracking + Logic vs Data Processing or Pilot + Firewall", kind: "Major", plain: "Send a fake owner command that the device carries out as its next major action.", watch: "Good for a quick unlock, with less setup than controlling it." },
  { name: "Format Device", goals: ["control", "fight"], legal: true, access: "Admin", test: "Electronics + Logic vs Willpower + Firewall (or Firewall x 2)", kind: "Major", plain: "Rewrite the boot code so the device shuts down for good on its next reboot.", watch: "It still works as a dumb mechanical device." },
  { name: "Snoop", goals: ["data", "learn"], legal: false, access: "Admin", test: "Cracking + Logic vs Logic + Firewall or Data Processing + Firewall", kind: "Major", plain: "Intercept the target's Matrix traffic as long as you have access.", watch: "You need storage if you want to replay it." },
  { name: "Trace Icon", goals: ["learn"], legal: false, access: "Admin", test: "Electronics + Intuition vs Willpower + Sleaze or Firewall + Sleaze", kind: "Major", plain: "Find the physical location of a persona or device.", watch: "Does not work on IC or hosts with no physical location." },
  { name: "Hide", goals: ["hide"], legal: false, access: "Any", test: "Cracking + Intuition vs Intuition + Data Processing or Data Processing + Sleaze", kind: "Major", plain: "Make an icon lose track of you. It must make a new Matrix Perception to find you.", watch: "Does not work on someone who already has User or Admin access to anything in your network." },
  { name: "Change Icon", goals: ["hide"], legal: true, access: "User / Admin", test: "No test", kind: "Minor", plain: "Swap what you look like. Fools people who do not inspect you. Matrix Perception sees through it.", watch: "Cosmetic only." },
  { name: "Erase Matrix Signature", goals: ["hide"], legal: false, access: "User / Admin", test: "Electronics + Logic vs Willpower + Firewall or Firewall x 2", kind: "Major", plain: "Wipe a Resonance signature left by a technomancer or sprite.", watch: "You need a Resonance rating." },
  { name: "Data Spike", goals: ["fight"], legal: false, access: "Any", test: "Cracking + Logic vs Data Processing + Firewall", kind: "Major", plain: "Hit a persona or device for Matrix damage: half your Attack (rounded up) plus net hits.", watch: "Attack-linked." },
  { name: "Tarpit", goals: ["fight"], legal: false, access: "Any", test: "Cracking + Logic vs Data Processing + Firewall", kind: "Major", plain: "Deal 1 plus net hits damage and cut the target's Data Processing by the same amount.", watch: "At 0 Data Processing the target cannot act. It recovers 1 per round." },
  { name: "Crash Program", goals: ["fight"], legal: false, access: "Admin", test: "Cracking + Logic vs Data Processing + Device Rating", kind: "Major", plain: "Scramble one running program. It stays dead until the device reboots.", watch: "You must name the program, so look first." },
  { name: "Reboot Device", goals: ["fight", "control"], legal: true, access: "Admin", test: "Electronics + Logic vs Willpower + Firewall (or Firewall x 2)", kind: "Major", plain: "Take the target offline until the end of the next round. Its OS and access reset.", watch: "You cannot do it while link-locked." },
  { name: "Jam Signals", goals: ["fight"], legal: false, access: "Admin", test: "Cracking + Logic", kind: "Major", plain: "Turn your device into a local jammer. Your hits add to noise for everything within 100 meters.", watch: "You cannot use that device for anything else meanwhile." },
  { name: "Full Matrix Defense", goals: ["fight", "out"], legal: true, access: "Any", test: "Add Firewall to all Matrix defense tests", kind: "Major", plain: "Hunker down until the end of the round. An Anytime action you can take outside your turn.", watch: "It does not remove an enemy, it only buys time." },
  { name: "Enter/Exit Host", goals: ["in", "out"], legal: true, access: "Depends", test: "No test", kind: "Minor", plain: "Step into or out of a host. Leaving needs no special access.", watch: "Bonus Edge is lost when you leave. Link-lock blocks it." },
  { name: "Switch Interface Mode", goals: ["out"], legal: true, access: "Any", test: "No test", kind: "Minor", plain: "Change between AR, cold-sim and hot-sim. Go to AR before you leave and you skip dumpshock.", watch: "Link-lock blocks it." },
  { name: "Jack Out", goals: ["out"], legal: true, access: "Any", test: "Electronics + Willpower vs Charisma + DP or Attack + DP (only if link-locked)", kind: "Major", plain: "Pull yourself out of the Matrix and reboot your device. You can only dump yourself.", watch: "Usually means dumpshock if you are in VR." },
  { name: "Reconfigure Matrix Attribute", goals: ["in", "fight"], legal: true, access: "Admin (your own)", test: "No test", kind: "Minor", plain: "Swap the base ratings of two of your non-zero Matrix attributes.", watch: "Attack and Sleaze are locked while you hold access from a hack." },
  { name: "Check OS", goals: ["learn"], legal: false, access: "Admin", test: "Cracking + Logic, threshold 4", kind: "Major", plain: "Find out your current Overwatch Score. The Baby Monitor program tells you for free.", watch: "It is an illegal action, so it adds OS if the defender rolls hits." },
];
