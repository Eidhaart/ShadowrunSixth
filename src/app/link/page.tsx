import { Page } from "@/components/Page";

const steps = [
  {
    t: "Start the relay",
    d: "On the machine that hosts your table, run the chat relay. It keeps rooms and the last 200 messages.",
    code: "npm run chat\n# PORT=8787 by default, set PORT to change it",
  },
  {
    t: "Jack in from the deck",
    d: "Open Comms, enter your handle, a room name and the relay address (ws://<host-ip>:8787), then press Jack in. Everyone at the table uses the same address and room.",
  },
  {
    t: "Install the bridge in Foundry",
    d: "Copy the foundry/sixthdeck-bridge folder from this project into Foundry's Data/modules folder and restart Foundry. Enable SixthDeck Bridge in your world, then set the relay address, room and handle in Module Settings.",
    code: "cp -r foundry/sixthdeck-bridge  <FoundryData>/Data/modules/",
  },
  {
    t: "Send a runner to Foundry",
    d: "Open a runner sheet and press For Foundry to save an actor file. In Foundry, open the Actors tab and press Import SixthDeck runner. The full build is kept on the actor, and skills and gear become items.",
  },
];

export default function LinkPage() {
  return (
    <Page title="Link" kicker="Connect SixthDeck to Foundry VTT. Chat and dice flow both ways, and runners move across as actor files.">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s.t} className="panel p-5">
              <h2 className="text-xl font-semibold"><span className="mr-2 font-mono text-accent">{i + 1}</span>{s.t}</h2>
              <p className="mt-1 max-w-2xl text-dim">{s.d}</p>
              {s.code && <pre className="mt-3 overflow-x-auto rounded border border-line bg-bg2 p-3 font-mono text-sm">{s.code}</pre>}
            </li>
          ))}
        </ol>
        <aside className="panel h-fit space-y-3 p-5 text-sm">
          <h2 className="text-lg font-semibold">What crosses over</h2>
          <ul className="list-disc space-y-1 pl-5 text-dim">
            <li>Chat messages, both ways</li>
            <li>Dice rolls: Foundry d6 rolls show as hit counts in the deck</li>
            <li>Deck rolls and initiative appear as Foundry chat cards</li>
            <li>Runner export: stats, skills, gear, qualities and the full build</li>
          </ul>
          <p className="text-dim">The Shadowrun game systems for Foundry each use their own actor fields, so the import keeps the complete build on the actor rather than guessing at another system&apos;s layout. The bridge has not been tested against a live Foundry install yet.</p>
        </aside>
      </div>
    </Page>
  );
}
