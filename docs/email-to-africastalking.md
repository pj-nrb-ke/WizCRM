# Email to AfricasTalking — copy below the line

**To:** voice@africastalking.com (CC your account manager if you have one)
**Subject:** SIP trunk setup request + Voice recording bug — account WizAccountant, +254730731120

---

Hello AfricasTalking team,

We are building an AI voice assistant for our business (WizAG, Nairobi) on the
number you recently assigned us, +254730731120 (account username: WizAccountant).
We have two items — the first is the priority.

## 1. SIP trunk setup (priority)

We want to connect +254730731120 to an external SIP platform (ElevenLabs,
SIP endpoint: sip.rtc.elevenlabs.io) instead of the HTTP callback, for both
inbound and outbound calls. Per your help centre this is supported via IP
whitelisting and a trunk callback (trunk:<ip>).

Please advise:

1. What exactly do you need from us to enable SIP trunking on this account?
2. Do you authenticate by IP whitelist only, or do you also support SIP
   registration / digest credentials? (The external platform originates from a
   cloud IP range, not a single static IP — if you require a single static IP,
   please say so and we will place an SBC in between.)
3. Which codecs do you support on the trunk? (The platform speaks G711 8kHz
   and G722 16kHz.) Do you support TLS transport and SRTP media?
4. For outbound calls originated over the trunk: what are the per-minute
   termination rates to Kenyan mobile networks, and will the caller ID be
   preserved as +254730731120?
5. What is the expected turnaround time to have this live?

## 2. Voice recording bug (for your engineers)

On the same account, partial-call recordings are unretrievable, which currently
breaks any speech-based IVR:

- Our XML uses a partial `<Record>` (child prompt + callbackUrl), as documented.
- Your callback POSTs a recordingUrl on the host `jolly-heisenberg-meninsky.at-internal.com`.
- That URL returns **HTTP 404** ("404 page not found") every time: immediately,
  after retries, and several minutes after the call — over https and http, with
  and without an apiKey header. The host root also returns 404.
- The final call notification (isActive=0) contains **no recordingUrl field**,
  so there is no alternative way to fetch the audio.

Example sessions:
- ATVId_c16489eba65ae38dcb186cbea2292df5 →
  https://jolly-heisenberg-meninsky.at-internal.com/ed3a43402826c88f43546c55182d598cT.mp3
- ATVId_54dfb362d47c347b6846246c3693da42 →
  https://jolly-heisenberg-meninsky.at-internal.com/f27eae6d7fee1cd521ec... (truncated)

Everything else works on this number: calls connect, `<Say>` and `<Play>`
(8 kHz mono mp3) play, `<GetDigits>` DTMF is captured, and call notifications
arrive. Only recording retrieval fails. Is recording perhaps not enabled for
this account, or is the URL meant to point at a public host?

Given item 1 is our production path, please treat the SIP trunk as the priority
and the recording bug as a report for your engineers.

Thank you,

Paramjeet Singh Bhambra
WizAG — wizag.biz
Account: WizAccountant · Number: +254730731120
