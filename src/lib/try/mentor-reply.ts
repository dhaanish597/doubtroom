/** Scripted replies from Arun, the demo senior. The judge's text is matched locally and never stored. */
type ScriptedReply = { keywords: RegExp; reply: string };

const SIGN_OFF = "\n\n(I'm the demo senior, so this reply is scripted. In real rooms, seniors from your college answer here.)";

const REPLIES: readonly ScriptedReply[] = [
  {
    keywords: /hand\s*shake|syn|3[\s-]?way|three[\s-]?way/i,
    reply: "Good question! The 3-way handshake lets both sides agree on starting sequence numbers. SYN says \"here's my number\", SYN-ACK says \"got it, here's mine\", and ACK confirms. With only 2 steps, an old duplicate SYN could open a ghost connection. For the exam, draw the timeline with seq and ack values. That's an easy 4 marks.",
  },
  {
    keywords: /congestion|flow control|window|slow start/i,
    reply: "Flow control protects the receiver (rwnd). Congestion control protects the network (cwnd). TCP sends min(rwnd, cwnd). Slow start doubles cwnd each RTT until ssthresh, then grows by one segment per RTT. Sketch the sawtooth graph. Examiners love it.",
  },
  {
    keywords: /dns|udp/i,
    reply: "DNS uses UDP on port 53 because a lookup is one small question and one small answer. Setting up a TCP connection would double the delay. It falls back to TCP for zone transfers and replies over 512 bytes. Write that exception down, it's a common 2-mark question.",
  },
  {
    keywords: /osi|tcp\/ip|layer/i,
    reply: "Remember the OSI layers with \"Please Do Not Throw Sausage Pizza Away\": Physical, Data link, Network, Transport, Session, Presentation, Application. For TCP/IP, merge the top three into Application and the bottom two into Link.",
  },
  {
    keywords: /rout|dijkstra|bellman|ospf|rip/i,
    reply: "Link state (OSPF) floods the full map and each router runs Dijkstra. Distance vector (RIP) shares only distances with neighbours using Bellman-Ford, which is why it suffers from count-to-infinity. Solve one small table by hand before the exam.",
  },
];

const DEFAULT_REPLY = "Hey! Thanks for reaching out. Tell me which unit you're stuck on. For Computer Networks, I'd revise Unit 2 (TCP and UDP) first because it carries the most marks. Also, check if the TA's answer was verified before you memorise it.";

export function demoMentorReply(text: string): string {
  const match = REPLIES.find(({ keywords }) => keywords.test(text));
  return `${match?.reply ?? DEFAULT_REPLY}${SIGN_OFF}`;
}
