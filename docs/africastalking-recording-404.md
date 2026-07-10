# AfricasTalking support — Voice `recordingUrl` returns 404

Copy the section below to `voice@africastalking.com` (or the dashboard support chat).

---

**Subject: Voice API — partial recording `recordingUrl` returns 404 (at-internal.com host)**

Account username: `WizAccountant`
DID under test: `+254730731120` (the replacement you provided)
Callback URL: `https://api.wizcrm.app/webhooks/africastalking/voice`

**Summary**

Outbound calls connect, our XML is fetched, and `<Play>` audio plays correctly. When the
caller speaks, `<Record>` completes and you POST a `recordingUrl` to our callback. **That URL
returns HTTP 404 and never becomes available**, so we can never retrieve the caller's audio.

**Our XML (partial recording, prompt nested as documented)**

```xml
<Response>
  <Play url="https://api.wizcrm.app/voice/audio/&lt;id&gt;.wav"/>
  <Record finishOnKey="#" maxLength="10" timeout="3" trimSilence="true" playBeep="false"
          callbackUrl="https://api.wizcrm.app/webhooks/africastalking/voice">
    <Say voice="woman">…prompt…</Say>
  </Record>
</Response>
```

**What you send us**

```
sessionId    = ATVId_54dfb362d47c347b6846246c3693da42
isActive     = 1
callerNumber = +254728956308
recordingUrl = https://jolly-heisenberg-meninsky.at-internal.com/f27eae6d7fee1cd521ec….mp3
```

Other affected sessions:

| sessionId | recordingUrl |
|---|---|
| `ATVId_c16489eba65ae38dcb186cbea2292df5` | `https://jolly-heisenberg-meninsky.at-internal.com/ed3a43402826c88f43546c55182d598cT.mp3` |
| `ATVId_c16489eba65ae38dcb186cbea2292df5` | `https://jolly-heisenberg-meninsky.at-internal.com/f17a2fcf11b24be2c96fae53d38c4511T.mp3` |

**What we observe when fetching it**

Every attempt returns `404` with the plain-text body `404 page not found`:

- immediately on receiving the callback → `404`
- retried 700 ms later → `404`
- several minutes after the call ended → `404`
- over plain `http://` instead of `https://` → `404`
- with an `apiKey:` header → `404`
- the **host root** `https://jolly-heisenberg-meninsky.at-internal.com/` → `404`

The host resolves and answers (`197.248.0.196`), so this is not DNS or a firewall on our side.

**Questions**

1. The hostname is `at-internal.com`. Is this URL intended to be reachable by customers?
   If not, which host should serve partial-call recordings?
2. Does voice recording need to be enabled on our account before `recordingUrl` resolves?
3. Is there a delay after which the file becomes available? We have waited several minutes.
4. Your end-of-call notification (`isActive=0`, `status=Success`, `durationInSeconds=46`)
   contains **no** `recordingUrl` field at all, so there is no alternative URL to fall back on.

Everything else on the account works: calls connect, `<Play>` audio plays, DTMF via
`<GetDigits>` is captured correctly, and call notifications arrive. Only recording retrieval fails.

---

## Internal notes

- `<Play>` requires **8 kHz mono** audio. A 24 kHz mp3 and an 8 kHz WAV both fetched and played
  silence; an 8 kHz mono mp3 played. **Caveat:** both failing responses also carried an
  `Accept-Ranges: bytes` header we advertised without honouring Range requests, and the passing
  one did not. Two variables changed. The sample rate is the likely cause but is not proven.
- A `<Record>` **with children** is a partial recording (posts `recordingUrl` to `callbackUrl`).
  A **childless** `<Record>` is a terminal recording and posts nothing. Do not un-nest the prompt.
- DTMF via `<GetDigits>` needs no recording and works today. It is the fallback if AT cannot
  serve recordings.
