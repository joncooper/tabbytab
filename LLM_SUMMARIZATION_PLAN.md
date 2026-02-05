# TabbyTab LLM Summarization: Architecture & Plan Options

## Executive Summary

TabbyTab is a Chrome Manifest V3 extension for tab management that currently generates tab summaries using a purely heuristic approach — parsing URLs and titles without any AI involvement. The goal is to add LLM-powered summarization so users can generate meaningful summaries of individual tabs, batch-summarize entire window groups from saved history, discover trends across their browsing, and store/search those summaries over time. This must be done incrementally and cheaply, ideally starting at zero cost.

The strongest approach is a **tiered multi-backend architecture** that defaults to Chrome's Built-in Summarizer API (Gemini Nano, shipping in Chrome 138+) for zero-config, free, private on-device summarization, then offers cloud APIs via OpenRouter for users who want higher quality or longer context, and finally supports local Ollama for power users who want full control. The existing heuristic summarizer remains as a silent fallback when no LLM backend is available. This tiered design means every user gets *something* — no one is left without summaries — while advanced users can unlock progressively better results.

A critical finding from the research: **Codex CLI and Claude Code CLI are not viable options** for this feature. Both are interactive coding agents designed for software development workflows, not programmatic summarization APIs. They require Node.js middleware servers, cannot be called directly from a Chrome extension, and are fundamentally the wrong tool for the job. The correct local option is either Chrome's Built-in AI or Ollama with a small model like Llama 3.2 3B.

## Current State

### What Exists and Is Ready

- **Heuristic summarizer** in `src/background/index.ts` (lines 22-90) generates basic summaries from URL structure and page titles. It works but produces shallow, formulaic output.
- **TabHistory data model** already includes a `summary` field, so the storage schema is ready for LLM-generated summaries with no migration needed.
- **History grouping** by window, domain, or title is fully implemented — this is the foundation for batch window group summarization.
- **Supabase sync** runs every 5 minutes in batches of 100, providing cloud persistence.
- **Export pipeline** supports JSONL, JSON, and CSV output. A 720+ line `LLM_ANALYSIS_EXAMPLES.md` file demonstrates how to use exported data with Claude and OpenAI APIs externally.
- **Host permissions** (`<all_urls>`) are already declared in the manifest, which means the service worker can make direct `fetch()` calls to any API without CORS issues.

### What Needs Fixing Before LLM Integration

The background service worker has two reliability bugs that will cause data loss and must be fixed before adding any LLM features:

1. **`tabCache` uses an in-memory `Map`** — this is a global variable that is destroyed every time the MV3 service worker terminates (after 30 seconds of idle). Cached tab data is silently lost.
2. **`setInterval` is used for cache refresh and Supabase sync** — intervals are killed when the service worker terminates and never re-established. Sync and refresh silently stop working.

## Key Findings

### What NOT to Do

**Do not use Codex CLI or Claude Code CLI for tab summarization.** This is the single most important negative finding from the research.

- **Codex CLI** is OpenAI's interactive coding agent. It is designed for writing, editing, and debugging code in a terminal. It requires a Node.js middleware server to bridge between the extension and the CLI process. It has no batch summarization mode, no programmatic API suitable for this use case, and its per-invocation overhead is enormous compared to a simple API call. Using it for tab summarization is like using a bulldozer to plant a flower.
- **Claude Code CLI / SDK** has the same fundamental problem. The Claude Code SDK is server-side Node.js only — it cannot run in a browser or Chrome extension. The CLI is an interactive agent, not a summarization endpoint. The correct way to use Claude for summarization is through the Anthropic Messages API directly, not through Claude Code.

Both tools would add massive complexity (native messaging hosts, Node.js servers, process management) for worse results than a single HTTP POST to any LLM API. The Anthropic and OpenAI *APIs* are excellent; their *CLI agent tools* are simply the wrong abstraction for this task.

### Critical Chrome Extension Constraints

Chrome Manifest V3 service workers impose hard constraints that shape the entire architecture:

1. **30-second idle timeout**: The service worker terminates after ~30 seconds of inactivity. Every LLM API call must either complete within this window or use a keep-alive mechanism.
2. **Global state is ephemeral**: Any data stored in JavaScript variables (Maps, arrays, objects) is destroyed on termination. All state that matters must live in `chrome.storage.local` or `chrome.storage.session`.
3. **`setInterval` / `setTimeout` are unreliable**: Timers die with the worker. Use `chrome.alarms` for periodic tasks.
4. **Only one offscreen document at a time**: If using an offscreen document for streaming LLM responses, it must be shared for all offscreen purposes.

**The offscreen document pattern is the recommended solution for LLM calls.** The architecture works as follows:

1. Service worker initiates a summarization request.
2. Service worker creates (or reuses) an offscreen document.
3. Offscreen document makes the `fetch()` call to the LLM API.
4. Offscreen document streams response chunks back to the service worker via `chrome.runtime.sendMessage()`.
5. Each message resets the service worker's idle timer, keeping it alive for the duration of the call.
6. Service worker persists the final summary to `chrome.storage.local`.

For Chrome's Built-in AI, the call happens directly in the service worker (it is a browser API, not a network call), so the offscreen document is not needed for that tier.

### Existing Bugs to Fix First

These two bugs are not just technical debt — they will actively interfere with LLM integration and cause data loss:

| Bug | Current Behavior | Impact on LLM Feature | Fix |
|---|---|---|---|
| `tabCache` is an in-memory `Map` | Cache is silently destroyed on SW termination | LLM summaries stored only in the Map would be lost | Migrate to `chrome.storage.session` (fast, in-memory, survives SW restarts within browser session) with overflow to `chrome.storage.local` |
| `setInterval` for sync/refresh | Intervals stop when SW dies, never restart | Batch summarization queue would stall, Supabase sync of summaries would stop | Replace with `chrome.alarms` API (minimum 1-minute granularity, survives SW restarts) |

## Provider Comparison Matrix

| Provider | Cost / 1K Tabs | Quality | Privacy | Setup Complexity | Latency | Context Window | Best For |
|---|---|---|---|---|---|---|---|
| **Chrome Built-in AI** (Gemini Nano) | Free | Good | Full (on-device) | Zero | ~1-3s | 1,024 tokens (Summarizer) / 4,096 (Prompt API) | Default for all users |
| **OpenRouter** (free models) | Free | Varies | Cloud | Low (API key) | 1-5s | Varies | Budget-conscious users |
| **Google Gemini Flash-Lite** | $0.098 | Good | Cloud | Low (API key) | 0.5-2s | 1M tokens | Cheapest paid cloud option |
| **GPT-5 nano** | $0.105 | Good | Cloud | Low (API key) | 0.5-2s | 128K tokens | OpenAI ecosystem users |
| **Groq** (Llama 4 Scout) | $0.123 | Good | Cloud | Low (API key) | 0.1-0.5s | 128K tokens | Speed-critical batch jobs |
| **GPT-4o-mini** | $0.195 | Very Good | Cloud | Low (API key) | 0.5-2s | 128K tokens | Quality/cost balance |
| **Claude 3 Haiku** | $0.375 | Very Good | Cloud | Low (API key) | 0.5-2s | 200K tokens | Quality-focused users |
| **Claude Haiku 4.5** | $1.50 | Excellent | Cloud | Low (API key) | 0.5-2s | 200K tokens | Best quality summaries |
| **Ollama** (Llama 3.2 3B) | Free | Good | Full (local) | High (install + configure) | 1-10s | 8K-128K tokens | Privacy-focused power users |
| **WebLLM / Transformers.js** | Free | Moderate | Full (in-browser) | Medium | 5-30s | Limited | Not recommended (complexity vs. benefit) |

**Clear winners by category:**
- **Best default**: Chrome Built-in AI — zero setup, free, private.
- **Best cloud**: OpenRouter — single API, free tier to start, 400+ models, browser-friendly CORS.
- **Best local alternative**: Ollama with Llama 3.2 3B — good quality, fully private, reasonable hardware requirements.
- **Best quality regardless of cost**: Claude Haiku 4.5 via Anthropic API or OpenRouter.
- **Cheapest paid**: Google Gemini 2.0 Flash-Lite at $0.098 per 1,000 tabs.

## Recommended Architecture

A tiered provider system with automatic fallback:

```
User opens popup / selects "Summarize"
              |
              v
   ┌─────────────────────┐
   │  Summarization       │
   │  Manager (SW)        │
   │                      │
   │  Checks user config  │
   │  for preferred tier  │
   └──────────┬───────────┘
              |
     ┌────────┼────────────────┬──────────────────┐
     v        v                v                  v
  ┌──────┐ ┌──────────┐ ┌───────────┐ ┌─────────────────┐
  │Tier 1│ │ Tier 2   │ │ Tier 3    │ │ Fallback        │
  │Chrome│ │ Cloud    │ │ Ollama    │ │ Heuristic       │
  │Built │ │ API      │ │ (local)   │ │ (current logic) │
  │-in AI│ │(OpenRouter│ │           │ │                 │
  │      │ │ / direct)│ │           │ │                 │
  └──┬───┘ └────┬─────┘ └─────┬────┘ └───────┬─────────┘
     |          |              |               |
     |    ┌─────┴──────┐      |               |
     |    │ Offscreen  │      |               |
     |    │ Document   │      |               |
     |    │ (fetch     │      |               |
     |    │  proxy)    │      |               |
     |    └─────┬──────┘      |               |
     |          |              |               |
     └────┬─────┴──────┬──────┘               |
          v            v                       v
   ┌──────────────────────────────────────────────┐
   │           chrome.storage.local                │
   │  ┌──────────────┐  ┌─────────────────────┐   │
   │  │ Tab History   │  │ Summary Cache       │   │
   │  │ (with summary │  │ (batch job state,   │   │
   │  │  field)       │  │  queue, progress)   │   │
   │  └──────────────┘  └─────────────────────┘   │
   └───────────────────────┬───────────────────────┘
                           |
                           v
                  ┌────────────────┐
                  │ Supabase Sync  │
                  │ (via alarms)   │
                  └────────────────┘
```

### Tier 1: Chrome Built-in AI (Zero Config)

- **API**: `Summarizer.create({ type, format, length })` and `summarizer.summarize(text)`
- **Availability**: Chrome 138+ (Origin Trial, expected stable mid-2025)
- **Types**: `key-points`, `tl;dr`, `teaser`, `headline`
- **Sweet spot for TabbyTab**: Use `tl;dr` type, `plain-text` format, `short` length for individual tab summaries. Use `key-points` for window group batch summaries.
- **Limitation**: 1,024-token input context for Summarizer API (roughly 750 words). This is sufficient for most tab content if we extract the main text intelligently. The Prompt API offers 4,096 tokens if more control is needed.
- **Hardware**: Requires 22GB disk, 16GB RAM, 4GB VRAM. Feature-detect at runtime and fall back gracefully.
- **Why Tier 1**: It is the only option that requires zero configuration, zero cost, and zero network access. Every user who meets the hardware requirements gets AI summaries out of the box.

### Tier 2: OpenRouter / Cloud APIs (BYOK)

- **Primary provider**: OpenRouter (`https://openrouter.ai/api/v1/chat/completions`). OpenAI-compatible endpoint, single API key works for 400+ models.
- **Why OpenRouter over direct provider APIs**: One integration covers all providers. Users can start with free models (Llama, Mistral, Gemma) and upgrade to paid models (GPT-4o-mini, Claude Haiku) without code changes. CORS headers are browser-friendly.
- **Key management**: BYOK (Bring Your Own Key). User enters their OpenRouter API key in extension settings. Store in `chrome.storage.session` (in-memory, not persisted to disk). For persistence across browser restarts, encrypt with Web Crypto API before writing to `chrome.storage.local`.
- **Recommended default model**: `meta-llama/llama-3.2-3b-instruct:free` (free) or `google/gemini-2.0-flash-lite-001` ($0.098/1K tabs) for paid.
- **Architecture**: Service worker delegates to offscreen document for the `fetch()` call. Offscreen document streams chunks back via messaging to keep the service worker alive.

### Tier 3: Local Models via Ollama (Power Users)

- **API**: `http://localhost:11434/api/generate` or OpenAI-compatible endpoint at `http://localhost:11434/v1/chat/completions`
- **CORS fix**: User must set `OLLAMA_ORIGINS=chrome-extension://*` environment variable before starting Ollama.
- **Recommended model**: `llama3.2:3b` — best balance of quality, speed, and memory usage for summarization tasks.
- **Architecture**: Same offscreen document pattern as Tier 2. The only difference is the endpoint URL.
- **Why Tier 3, not Tier 1**: Setup friction is high. User must install Ollama, pull a model (2-4GB download), configure CORS, and keep Ollama running. This is a power-user feature.

### Fallback: Current Heuristic Summarization

The existing URL/title parsing logic in `src/background/index.ts` lines 22-90 remains as the silent fallback. If Chrome Built-in AI is unavailable (hardware, browser version), no cloud API key is configured, and Ollama is not running, the extension continues to work exactly as it does today. No user is ever left without summaries.

## Implementation Plan Options

### Option A: Minimal Viable (Chrome Built-in AI Only)

| Dimension | Detail |
|---|---|
| **Scope** | Integrate Chrome Summarizer API for individual tab summaries. Feature-detect availability. Fall back to heuristic if unavailable. |
| **Effort** | ~1-2 weeks for one developer |
| **Cost** | $0 (free, on-device) |
| **Limitations** | Only works in Chrome 138+. 1,024-token context may truncate long pages. No batch window summarization. No trend analysis. ~50% of users may not meet hardware requirements. |
| **Best for** | Shipping something fast to validate the UX before investing in the full backend system. |

### Option B: Cloud-First with Local Fallback

| Dimension | Detail |
|---|---|
| **Scope** | OpenRouter integration as primary backend. Chrome Built-in AI as zero-config default. Heuristic as final fallback. Settings UI for API key entry and model selection. Individual + batch summarization. |
| **Effort** | ~3-4 weeks for one developer |
| **Cost** | Free (with free models) to ~$0.10-$0.20/month for typical usage (100-200 tabs/month on paid models) |
| **Limitations** | No local Ollama support. Requires internet for cloud tier. Requires API key for cloud tier. |
| **Best for** | The practical choice. Covers 90%+ of users with a good experience. |

### Option C: Full Multi-Backend System

| Dimension | Detail |
|---|---|
| **Scope** | All three tiers + heuristic fallback. Provider abstraction layer. Settings UI with provider selection, model selection, API key management. Individual + batch + window group summarization. Trend analysis across summaries. Summary search and organization. |
| **Effort** | ~6-8 weeks for one developer |
| **Cost** | Variable (free to ~$1.50/month depending on usage and provider) |
| **Limitations** | Significant testing surface (4 backends x multiple models). Ollama CORS setup requires user documentation. |
| **Best for** | The full vision. Build this incrementally using the phased roadmap below. |

**Recommendation**: Start with Option B's scope but architect for Option C. Build the provider abstraction layer from the start so adding Ollama later is a configuration change, not a rewrite.

## Incremental Implementation Roadmap

### Phase 0: Fix Foundation (tabCache, setInterval Bugs)

**Priority**: Critical. Do this before any LLM work.

**Tasks**:
1. Replace `tabCache` (in-memory `Map`) with `chrome.storage.session` for hot data and `chrome.storage.local` for persistence. Create a thin `TabCacheService` wrapper that provides the same `get`/`set`/`delete` interface but is backed by storage APIs.
2. Replace all `setInterval` calls with `chrome.alarms`. Create alarms for:
   - Cache refresh: `chrome.alarms.create('cache-refresh', { periodInMinutes: 1 })`
   - Supabase sync: `chrome.alarms.create('supabase-sync', { periodInMinutes: 5 })`
3. Add `chrome.alarms.onAlarm` listener in the service worker to dispatch alarm events.
4. Test that tab tracking survives service worker restarts (close DevTools, wait 30+ seconds, reopen).

**Effort**: 2-3 days.

### Phase 1: Chrome Built-in AI Integration

**Tasks**:
1. Feature-detect Summarizer API availability:
   ```typescript
   const canUseSummarizer = 'Summarizer' in self;
   ```
2. Create `SummarizerProvider` interface:
   ```typescript
   interface SummarizerProvider {
     id: string;
     name: string;
     isAvailable(): Promise<boolean>;
     summarize(content: string, options?: SummarizeOptions): Promise<string>;
     summarizeBatch(items: SummarizeItem[]): AsyncGenerator<SummarizeResult>;
   }
   ```
3. Implement `ChromeBuiltInProvider` using the Summarizer API with `type: 'tl;dr'`, `format: 'plain-text'`, `length: 'short'`.
4. Implement `HeuristicProvider` wrapping the existing logic from `src/background/index.ts` lines 22-90.
5. Create `SummarizationManager` that tries providers in tier order and falls back.
6. Wire into the existing `generateSummary()` call site so summaries are transparently upgraded.
7. Add a simple indicator in the popup UI showing which summarization backend was used (e.g., a small "AI" badge vs. no badge for heuristic).

**Effort**: 1-1.5 weeks.

### Phase 2: Cloud API Integration (OpenRouter)

**Tasks**:
1. Create offscreen document (`src/offscreen/llm-proxy.html` + `src/offscreen/llm-proxy.ts`) for proxying LLM API calls. The document:
   - Listens for `chrome.runtime.onMessage` with type `llm-request`.
   - Makes `fetch()` to the configured API endpoint.
   - Streams response chunks back via `chrome.runtime.sendMessage` with type `llm-chunk`.
   - Sends final `llm-complete` message.
2. Implement `OpenRouterProvider` using the offscreen document:
   - Endpoint: `https://openrouter.ai/api/v1/chat/completions`
   - Default model: `meta-llama/llama-3.2-3b-instruct:free`
   - System prompt: `"Summarize this web page content in 1-2 concise sentences. Focus on the main topic and key information."`
3. Build settings UI panel in the popup for:
   - Provider selection (Chrome Built-in / OpenRouter / Ollama)
   - API key entry (with show/hide toggle)
   - Model selection dropdown (populated from OpenRouter model list or manual entry)
   - Test connection button
4. Implement API key storage:
   - Primary: `chrome.storage.session` (in-memory, secure)
   - Persistent option: Encrypt with `crypto.subtle.encrypt()` (AES-GCM) using a key derived from extension ID + user-provided passphrase, store ciphertext in `chrome.storage.local`
5. Add rate limiting: Maximum 5 concurrent requests, exponential backoff on 429 responses.

**Effort**: 2-2.5 weeks.

### Phase 3: Local Model Support (Ollama)

**Tasks**:
1. Implement `OllamaProvider` using the same offscreen document:
   - Endpoint: `http://localhost:11434/v1/chat/completions` (OpenAI-compatible)
   - Default model: `llama3.2:3b`
   - Health check: `GET http://localhost:11434/api/tags` to verify Ollama is running and list available models.
2. Add Ollama-specific settings:
   - Custom endpoint URL (for non-default ports)
   - Model selection from detected models (populated via health check)
   - Setup instructions link/tooltip explaining `OLLAMA_ORIGINS` configuration
3. Auto-detect Ollama availability on settings page load.

**Effort**: 3-5 days (most of the infrastructure is built in Phase 2).

### Phase 4: Batch Window Group Summarization & Trend Analysis

**Tasks**:
1. Add "Summarize Window" button to history view window groups. When clicked:
   - Collect all tabs in the window group.
   - Send each tab for individual summarization (respecting concurrency limits).
   - Generate a meta-summary of the window group: "This window was about [topic]. Key pages: [list]."
2. Implement batch processing queue:
   - Persist queue state in `chrome.storage.local` so it survives service worker restarts.
   - Use `chrome.alarms` to poll the queue and process items.
   - Show progress bar in the UI.
   - Support cancel/pause.
3. Add "Summarize All Unsummarized" action that queues all history entries without summaries.
4. Implement trend analysis:
   - After batch summarization, cluster summaries by topic using keyword extraction (TF-IDF or simple frequency analysis — no LLM needed for this step).
   - Present trends as "You spent time on: [topic clusters with counts]" in a new Insights panel.
5. Optionally: Use an LLM call to generate a natural-language weekly/daily digest from clustered summaries.

**Effort**: 2-3 weeks.

### Phase 5: Summary Storage, Organization, and Search

**Tasks**:
1. Extend the TabHistory schema to track summary metadata:
   - `summaryProvider`: which backend generated it (chrome-ai, openrouter, ollama, heuristic)
   - `summaryModel`: specific model used
   - `summaryTimestamp`: when the summary was generated
   - `summaryVersion`: for re-summarization when models improve
2. Add full-text search across summaries in the history view (client-side filtering is sufficient for typical history sizes of <10K entries).
3. Add summary quality indicators: users can thumbs-up/thumbs-down summaries, which informs future provider selection.
4. Sync summaries to Supabase (already partially supported via the `summary` field and existing sync logic).
5. Add export of summaries in the existing JSONL/JSON/CSV export pipeline (likely already works since `summary` is in TabHistory).

**Effort**: 1-2 weeks.

## Cost Analysis

Assuming a typical user manages 100-500 tabs per month and summarizes most of them:

| Usage Level | Chrome Built-in AI | OpenRouter (Free Models) | Gemini Flash-Lite | GPT-4o-mini | Claude Haiku 4.5 | Ollama |
|---|---|---|---|---|---|---|
| Light (100 tabs/mo) | $0.00 | $0.00 | $0.01 | $0.02 | $0.15 | $0.00 |
| Moderate (500 tabs/mo) | $0.00 | $0.00 | $0.05 | $0.10 | $0.75 | $0.00 |
| Heavy (2,000 tabs/mo) | $0.00 | $0.00 | $0.20 | $0.39 | $3.00 | $0.00 |
| Power (5,000 tabs/mo) | $0.00 | $0.00 | $0.49 | $0.98 | $7.50 | $0.00 |

**Key takeaway**: For the vast majority of users, summarization is effectively free. Chrome Built-in AI and OpenRouter free models cover the common case at zero cost. Even heavy users on paid models spend less than a dollar per month unless they choose premium models like Claude Haiku 4.5. The cost concern that motivated this research is largely a non-issue — the architecture decisions around service worker lifecycle and provider abstraction are far more important than cost optimization.

**Batch discount note**: OpenAI and Anthropic offer 50% batch API discounts for non-real-time processing. Since window group summarization is not latency-sensitive, batch APIs could halve the costs in the table above for those providers.

## Open Questions & Decisions Needed

1. **Chrome Built-in AI availability timeline**: The Summarizer API is in Origin Trial. When does it ship stable? If it ships in Chrome 138 (expected mid-2025), should we wait for it or launch with cloud-only first? **Recommendation**: Build the provider abstraction now and ship Phase 2 (OpenRouter) first. Add Chrome Built-in AI when it stabilizes. The abstraction layer makes this a drop-in addition.

2. **Content extraction strategy**: LLMs need page content, not just URLs and titles. How do we get it?
   - **Option A**: Inject a content script that extracts `document.body.innerText` or uses Readability.js. This gives the richest input but requires `activeTab` or content script permissions.
   - **Option B**: Summarize from URL + title only (current approach, but with an LLM). Lower quality but zero additional permissions.
   - **Option C**: Use a web content extraction API (e.g., Jina Reader at `https://r.jina.ai/{url}`). Adds a network dependency but no permission changes.
   - **Recommendation**: Option A. The extension already has `<all_urls>` host permissions. A content script that extracts main text (using a lightweight Readability implementation) gives the best input for summarization.

3. **Summary regeneration policy**: When a user upgrades from heuristic to AI summarization, should we re-summarize all existing history? **Recommendation**: No, not automatically. Add a "Re-summarize with AI" button on individual entries and a "Summarize All Unsummarized" bulk action. Do not overwrite existing summaries without user action.

4. **Offscreen document lifetime**: Should the offscreen document be created on-demand (per summarization batch) or kept alive persistently? **Recommendation**: On-demand. Create it when a cloud/Ollama summarization starts, close it when the batch completes. This avoids resource waste. Remember: only one offscreen document can exist at a time across the entire extension.

5. **UI surface for summarization**: Where does the user trigger summarization?
   - Automatic on tab close (background, silent)
   - Manual button per tab in the popup
   - Manual button per window group in history
   - Bulk action in history
   - **Recommendation**: All of the above. Automatic summarization on tab close (if a provider is available) is the highest-value UX because it requires zero user action. Manual triggers are complementary for history and re-summarization.

6. **Provider abstraction granularity**: Should the provider interface support streaming, or is request/response sufficient? **Recommendation**: Support streaming from the start. Streaming enables progress indicators for long summarizations and is essential for the offscreen document keep-alive pattern. The interface should use `AsyncGenerator<string>` for streaming and `Promise<string>` for simple cases.

7. **Testing strategy for multiple backends**: How do we test 4 different providers without running up API costs or requiring local GPU hardware in CI? **Recommendation**: Mock all provider HTTP calls in unit tests. Create a `MockProvider` that returns canned summaries. Integration-test one provider (OpenRouter with a free model) in a manual test matrix. Use the heuristic provider as a baseline comparison.

8. **What is the minimum Chrome version to support?** The extension currently works on any MV3-compatible Chrome (88+). Chrome Built-in AI requires 138+. **Recommendation**: Keep the minimum at Chrome 88+ for the extension itself. Feature-detect Chrome Built-in AI at runtime. Users on older Chrome simply do not see that option.
