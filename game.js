/* QuestTrack RPG (no frameworks)
   Files: index.html, style.css, game.js
   Data stored locally via localStorage.
*/

(() => {
  "use strict";

  const LS_KEY = "qtrpg_v1";

  const PAGES = [
    { id: "dashboard", label: "Dashboard" },
    { id: "quests", label: "Quests" },
    { id: "shop", label: "Shop" },
    { id: "inventory", label: "Inventory" },
    { id: "achievements", label: "Achievements" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "profile", label: "Profile" },
    { id: "settings", label: "Settings" },
  ];

  const SHOP_ITEMS = [
    {
      id: "frame_glow",
      name: "Glow Frame",
      desc: "A bright, icy-blue glow around your avatar.",
      type: "frame",
      cssClass: "frame-glow",
      price: 250,
    },
    {
      id: "frame_royal",
      name: "Royal Frame",
      desc: "A golden, legendary-looking border.",
      type: "frame",
      cssClass: "frame-royal",
      price: 400,
    },
    {
      id: "frame_shadow",
      name: "Shadow Frame",
      desc: "A dark, sleek border for stealth builds.",
      type: "frame",
      cssClass: "frame-shadow",
      price: 200,
    },
    {
      id: "theme_neon",
      name: "Neon Theme",
      desc: "Stronger neon highlights across the UI.",
      type: "theme",
      theme: "neon",
      price: 300,
    },
    {
      id: "theme_emerald",
      name: "Emerald Theme",
      desc: "Green-tinted highlights for calm focus.",
      type: "theme",
      theme: "emerald",
      price: 300,
    },
    {
      id: "theme_rose",
      name: "Rose Theme",
      desc: "Warm rose accents. Cozy and confident.",
      type: "theme",
      theme: "rose",
      price: 300,
    },
  ];

  const ACHIEVEMENTS = [
    { id: "a_firstquest", name: "First Blood", desc: "Complete your first quest.", icon: "🗡️" },
    { id: "a_10quests", name: "Questing Habit", desc: "Complete 10 quests total.", icon: "📜" },
    { id: "a_50quests", name: "Guild Veteran", desc: "Complete 50 quests total.", icon: "🏰" },
    { id: "a_level5", name: "Apprentice", desc: "Reach level 5.", icon: "✨" },
    { id: "a_level10", name: "Adept", desc: "Reach level 10.", icon: "🌟" },
    { id: "a_streak3", name: "On Fire", desc: "Maintain a 3-day streak.", icon: "🔥" },
    { id: "a_streak7", name: "Unstoppable", desc: "Maintain a 7-day streak.", icon: "🔥🔥" },
    { id: "a_1000coins", name: "Merchant Mindset", desc: "Hold 1000 coins at once.", icon: "🪙" },
    { id: "a_buy1", name: "First Purchase", desc: "Buy an item from the shop.", icon: "🛍️" },
    { id: "a_profilepic", name: "Portrait Ready", desc: "Set a custom profile picture.", icon: "🖼️" },
  ];

  // ----- Utilities -----
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function nowISODate() {
    // local date string YYYY-MM-DD
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function daysBetween(isoA, isoB) {
    const a = new Date(isoA + "T00:00:00");
    const b = new Date(isoB + "T00:00:00");
    const ms = b - a;
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function uid() {
    return Math.random().toString(16).slice(2) + "-" + Math.random().toString(16).slice(2);
  }

  function toast(msg, type = "good", sub = "") {
    const wrap = $("#toasts");
    const el = document.createElement("div");
    el.className = `toast ${type === "bad" ? "bad" : "good"}`;
    el.innerHTML = `<div>${escapeHtml(msg)}</div>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(6px)"; }, 2600);
    setTimeout(() => el.remove(), 3200);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Very light “hash” (NOT real security). This is a local demo app.
  function weakHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  // ----- Data model -----
  function defaultState() {
    return {
      meta: { version: 1 },
      session: { currentUserId: null, lastHelloForUserId: null },
      users: [],
    };
  }

  function defaultUser({ username, email, password, secQ, secA }) {
    const created = nowISODate();
    return {
      id: uid(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passHash: weakHash(password),
      security: { q: secQ.trim(), aHash: weakHash(secA.trim().toLowerCase()) },

      created,
      lastLoginDate: null,

      // Profile
      bio: "",
      avatarDataUrl: null,
      equipped: { frame: null, theme: null },
      owned: { frames: [], themes: [] },

      // RPG stats
      xp: 0,
      coins: 200,
      totalQuestsCompleted: 0,
      totalCoinsEarned: 0,
      streak: 0,
      lastActiveDate: null, // YYYY-MM-DD when user last completed a quest
      activity: [], // {date, text}

      // Quests
      quests: [], // {id, title, notes, difficulty, createdAt, completedAt|null}

      // Achievements
      achievements: [], // list of ids unlocked
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaultState();
      if (!parsed.users) parsed.users = [];
      if (!parsed.session) parsed.session = { currentUserId: null, lastHelloForUserId: null };
      return parsed;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function getUserById(id) {
    return state.users.find(u => u.id === id) || null;
  }

  function getCurrentUser() {
    const id = state.session.currentUserId;
    if (!id) return null;
    return getUserById(id);
  }

  // Level system
  function xpForLevel(level) {
    // total XP needed to reach this level
    // grows smoothly; level 1 starts at 0
    return Math.floor(100 * Math.pow(level - 1, 1.6));
  }

  function levelFromXp(xp) {
    // find max level such that xp >= xpForLevel(level)
    let lvl = 1;
    while (xp >= xpForLevel(lvl + 1)) lvl++;
    return lvl;
  }

  function levelProgress(xp) {
    const lvl = levelFromXp(xp);
    const curBase = xpForLevel(lvl);
    const nextBase = xpForLevel(lvl + 1);
    const into = xp - curBase;
    const span = Math.max(1, nextBase - curBase);
    return { lvl, into, span, pct: clamp((into / span) * 100, 0, 100), nextBase };
  }

  function difficultyRewards(diff) {
    // returns {xp, coins}
    switch (diff) {
      case "Easy": return { xp: 15, coins: 12 };
      case "Medium": return { xp: 30, coins: 22 };
      case "Hard": return { xp: 55, coins: 40 };
      case "Epic": return { xp: 90, coins: 70 };
      default: return { xp: 20, coins: 15 };
    }
  }

  function addActivity(user, text) {
    user.activity.unshift({ date: nowISODate(), text });
    user.activity = user.activity.slice(0, 20);
  }

  function unlockAchievement(user, id) {
    if (user.achievements.includes(id)) return false;
    user.achievements.push(id);
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (ach) toast(`Achievement unlocked: ${ach.icon} ${ach.name}`, "good", ach.desc);
    return true;
  }

  function evaluateAchievements(user) {
    const lvl = levelFromXp(user.xp);

    if (user.totalQuestsCompleted >= 1) unlockAchievement(user, "a_firstquest");
    if (user.totalQuestsCompleted >= 10) unlockAchievement(user, "a_10quests");
    if (user.totalQuestsCompleted >= 50) unlockAchievement(user, "a_50quests");

    if (lvl >= 5) unlockAchievement(user, "a_level5");
    if (lvl >= 10) unlockAchievement(user, "a_level10");

    if (user.streak >= 3) unlockAchievement(user, "a_streak3");
    if (user.streak >= 7) unlockAchievement(user, "a_streak7");

    if (user.coins >= 1000) unlockAchievement(user, "a_1000coins");

    if (user.owned.frames.length + user.owned.themes.length >= 1) unlockAchievement(user, "a_buy1");
    if (user.avatarDataUrl) unlockAchievement(user, "a_profilepic");
  }

  function applyTheme(user) {
    // default
    let brand = "#7c5cff";
    let brand2 = "#35d0ff";

    if (user?.equipped?.theme === "emerald") { brand = "#34d399"; brand2 = "#35d0ff"; }
    if (user?.equipped?.theme === "rose") { brand = "#fb7185"; brand2 = "#fbbf24"; }
    if (user?.equipped?.theme === "neon") { brand = "#35d0ff"; brand2 = "#7c5cff"; }

    document.documentElement.style.setProperty("--brand", brand);
    document.documentElement.style.setProperty("--brand2", brand2);
  }

  function avatarFrameClass(user) {
    const frame = user?.equipped?.frame;
    if (frame === "frame-glow") return "frame-glow";
    if (frame === "frame-royal") return "frame-royal";
    if (frame === "frame-shadow") return "frame-shadow";
    return "";
  }

  // ----- Rendering -----
  const state = loadState();
  const root = document.getElementById("appRoot");

  const ui = {
    page: "dashboard",
    questFilter: "All", // All, Active, Completed
    questSearch: "",
  };

  function render() {
    const user = getCurrentUser();
    applyTheme(user);

    if (!user) {
      root.innerHTML = renderAuth();
      bindAuth();
      return;
    }

    // Show hello again once per login session
    if (state.session.lastHelloForUserId !== user.id) {
      state.session.lastHelloForUserId = user.id;
      saveState();
      toast(`Hello again, ${user.username}!`, "good", "Your quests are waiting.");
    }

    root.innerHTML = `
      ${renderTopbar(user)}
      <div class="container">
        <div class="grid">
          ${renderSidebar(user)}
          <div class="main">
            ${renderMain(user)}
          </div>
        </div>
      </div>
      ${renderBottomNav()}
    `;

    bindApp();
  }

  function renderTopbar(user) {
    const lp = levelProgress(user.xp);
    return `
      <div class="topbar">
        <div class="inner">
          <div class="brand">
            <div class="logo" aria-hidden="true"></div>
            <div class="title">
              <b>QuestTrack RPG</b>
              <span>Turn tasks into XP • Level up your life</span>
            </div>
          </div>

          <div class="chipRow">
            <div class="chip"><span class="dot"></span><small>Lvl</small><b>${lp.lvl}</b></div>
            <div class="chip"><small>Coins</small><b>${user.coins}</b></div>
            <div class="chip"><small>Streak</small><b>${user.streak}🔥</b></div>
            <button class="btn small danger" id="btnLogout" title="Log out">Logout</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSidebar(user) {
    const frameClass = avatarFrameClass(user);
    const avatarSrc = user.avatarDataUrl
      ? `<img alt="Profile picture" src="${user.avatarDataUrl}">`
      : `<div class="miniAvatar">No Pic</div>`;

    const lp = levelProgress(user.xp);

    const questCountActive = user.quests.filter(q => !q.completedAt).length;

    return `
      <aside class="sidebar">
        <div class="userCard">
          <div class="avatar ${frameClass}">
            ${avatarSrc}
          </div>
          <div class="userMeta">
            <b>${escapeHtml(user.username)}</b>
            <span>${escapeHtml(user.email)}</span>
            <span style="margin-top:4px; color: var(--muted); font-size:12px;">XP: ${user.xp} • Next: ${lp.nextBase}</span>
          </div>
        </div>

        <div class="hr"></div>

        <div class="nav" id="sideNav">
          ${PAGES.map(p => {
            const tag =
              p.id === "quests" ? `<span class="rightTag">${questCountActive} active</span>` :
              p.id === "achievements" ? `<span class="rightTag">${user.achievements.length}/${ACHIEVEMENTS.length}</span>` :
              p.id === "inventory" ? `<span class="rightTag">${(user.owned.frames.length + user.owned.themes.length)} items</span>` :
              `<span class="rightTag"> </span>`;
            return `
              <button data-page="${p.id}" class="${ui.page === p.id ? "active" : ""}">
                <span>${escapeHtml(p.label)}</span>
                ${tag}
              </button>
            `;
          }).join("")}
        </div>

        <div class="hr"></div>

        <div class="notice">
          <b>Tip:</b> Add a quest, mark it complete, and watch your streak grow.
          <div style="margin-top:8px;">
            <span class="pill">Quests = XP</span>
            <span class="pill">XP = Levels</span>
            <span class="pill">Coins = Cosmetics</span>
          </div>
        </div>
      </aside>
    `;
  }

  function renderBottomNav() {
    const quick = ["dashboard", "quests", "shop", "profile"];
    return `
      <div class="bottomNav">
        <div class="row">
          ${quick.map(id => {
            const p = PAGES.find(x => x.id === id);
            return `<button data-page="${id}" class="${ui.page === id ? "active" : ""}">${escapeHtml(p.label)}</button>`;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderMain(user) {
    switch (ui.page) {
      case "dashboard": return renderDashboard(user);
      case "quests": return renderQuests(user);
      case "shop": return renderShop(user);
      case "inventory": return renderInventory(user);
      case "achievements": return renderAchievements(user);
      case "leaderboard": return renderLeaderboard(user);
      case "profile": return renderProfile(user);
      case "settings": return renderSettings(user);
      default: return renderDashboard(user);
    }
  }

  function renderDashboard(user) {
    const lp = levelProgress(user.xp);
    const active = user.quests.filter(q => !q.completedAt).length;
    const completed = user.quests.filter(q => q.completedAt).length;

    const recent = user.activity.slice(0, 8);

    return `
      <section class="panel">
        <h1 class="h1">Dashboard</h1>
        <p class="sub">Your basecamp. Track progress, streaks, and momentum.</p>

        <div class="cards">
          <div class="card">
            <b>Level</b>
            <div class="kpi">${lp.lvl}<small>(${lp.into}/${lp.span} XP)</small></div>
            <div class="progress" title="XP progress"><i style="width:${lp.pct.toFixed(1)}%"></i></div>
            <div class="helper">Next level at <span class="kbd">${lp.nextBase} XP</span></div>
          </div>

          <div class="card">
            <b>Coins</b>
            <div class="kpi">${user.coins}<small>🪙</small></div>
            <div class="helper">Earn coins by completing quests.</div>
          </div>

          <div class="card">
            <b>Streak</b>
            <div class="kpi">${user.streak}<small>🔥 days</small></div>
            <div class="helper">Complete ≥1 quest per day to keep it.</div>
          </div>

          <div class="card">
            <b>Quests</b>
            <div class="kpi">${active}<small>active</small></div>
            <div class="helper">${completed} completed total.</div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="split">
          <div class="panel" style="margin:0;">
            <h2 class="h1" style="font-size:16px;">Quick Add Quest</h2>
            <p class="sub">Drop in a mission and start earning XP.</p>
            <div class="row">
              <div class="field">
                <label>Quest Title</label>
                <input id="qaTitle" placeholder="e.g., Finish math homework" maxlength="80"/>
              </div>
              <div class="field">
                <label>Difficulty</label>
                <select id="qaDiff">
                  <option>Easy</option>
                  <option selected>Medium</option>
                  <option>Hard</option>
                  <option>Epic</option>
                </select>
              </div>
            </div>
            <div class="field" style="margin-top:10px;">
              <label>Notes (optional)</label>
              <textarea id="qaNotes" placeholder="Add details or steps..."></textarea>
            </div>
            <div class="row" style="margin-top:10px; align-items:center;">
              <button class="btn primary" id="btnQuickAdd">Add Quest</button>
              <button class="btn" id="btnGoQuests">Go to Quest Log</button>
            </div>
          </div>

          <div class="panel" style="margin:0;">
            <h2 class="h1" style="font-size:16px;">Recent Activity</h2>
            <p class="sub">Your last actions.</p>

            ${recent.length ? `
              <table class="table">
                <thead><tr><th>Date</th><th>Event</th></tr></thead>
                <tbody>
                  ${recent.map(a => `<tr><td>${escapeHtml(a.date)}</td><td>${escapeHtml(a.text)}</td></tr>`).join("")}
                </tbody>
              </table>
            ` : `
              <div class="notice">No activity yet. Complete a quest to start your log.</div>
            `}
          </div>
        </div>
      </section>
    `;
  }

  function renderQuests(user) {
    const q = user.quests.slice().sort((a,b) => {
      const at = a.completedAt ? 1 : 0;
      const bt = b.completedAt ? 1 : 0;
      if (at !== bt) return at - bt; // active first
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    const filtered = q.filter(item => {
      if (ui.questFilter === "Active" && item.completedAt) return false;
      if (ui.questFilter === "Completed" && !item.completedAt) return false;
      if (ui.questSearch.trim()) {
        const s = ui.questSearch.trim().toLowerCase();
        const hay = (item.title + " " + (item.notes || "")).toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });

    return `
      <section class="panel">
        <h1 class="h1">Quest Log</h1>
        <p class="sub">Add quests, finish them, and earn XP + coins.</p>

        <div class="panel" style="margin:0 0 14px;">
          <h2 class="h1" style="font-size:16px;">Add New Quest</h2>
          <div class="row">
            <div class="field">
              <label>Title</label>
              <input id="qTitle" placeholder="e.g., Study 30 minutes" maxlength="80"/>
            </div>
            <div class="field">
              <label>Difficulty</label>
              <select id="qDiff">
                <option>Easy</option>
                <option selected>Medium</option>
                <option>Hard</option>
                <option>Epic</option>
              </select>
            </div>
          </div>
          <div class="field" style="margin-top:10px;">
            <label>Notes (optional)</label>
            <textarea id="qNotes" placeholder="Steps, checklist, tips..."></textarea>
          </div>
          <div class="row" style="margin-top:10px;">
            <button class="btn primary" id="btnAddQuest">Add Quest</button>
            <button class="btn" id="btnAddExample">Add Example Quests</button>
          </div>
        </div>

        <div class="row" style="align-items:center;">
          <div class="field" style="flex: 2 1 260px;">
            <label>Search</label>
            <input id="qSearch" placeholder="Search quests..." value="${escapeHtml(ui.questSearch)}"/>
          </div>
          <div class="field">
            <label>Filter</label>
            <select id="qFilter">
              <option ${ui.questFilter==="All"?"selected":""}>All</option>
              <option ${ui.questFilter==="Active"?"selected":""}>Active</option>
              <option ${ui.questFilter==="Completed"?"selected":""}>Completed</option>
            </select>
          </div>
        </div>

        <div class="hr"></div>

        ${filtered.length ? `
          <table class="table" id="questTable">
            <thead>
              <tr>
                <th>Quest</th>
                <th>Difficulty</th>
                <th>Rewards</th>
                <th>Status</th>
                <th style="width: 240px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(item => {
                const r = difficultyRewards(item.difficulty);
                const status = item.completedAt
                  ? `<span class="badge good">Completed</span>`
                  : `<span class="badge warn">Active</span>`;
                const diffBadge =
                  item.difficulty === "Easy" ? "good" :
                  item.difficulty === "Medium" ? "" :
                  item.difficulty === "Hard" ? "warn" : "bad";
                return `
                  <tr data-qid="${item.id}">
                    <td>
                      <b>${escapeHtml(item.title)}</b>
                      ${item.notes ? `<div class="helper">${escapeHtml(item.notes)}</div>` : ""}
                      <div class="helper">Created: ${escapeHtml(item.createdAt)}</div>
                      ${item.completedAt ? `<div class="helper">Completed: ${escapeHtml(item.completedAt)}</div>` : ""}
                    </td>
                    <td><span class="badge ${diffBadge}">${escapeHtml(item.difficulty)}</span></td>
                    <td><span class="badge">+${r.xp} XP</span> <span class="badge">+${r.coins} 🪙</span></td>
                    <td>${status}</td>
                    <td>
                      ${item.completedAt ? `
                        <button class="btn small" data-action="undo">Undo</button>
                      ` : `
                        <button class="btn small primary" data-action="complete">Complete</button>
                      `}
                      <button class="btn small" data-action="edit">Edit</button>
                      <button class="btn small danger" data-action="delete">Delete</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        ` : `
          <div class="notice">No quests match your filter/search. Add one above to begin!</div>
        `}
      </section>
    `;
  }

  function renderShop(user) {
    const ownedIds = new Set([
      ...user.owned.frames.map(x => `frame_${x}`),
      ...user.owned.themes.map(x => `theme_${x}`),
    ]);

    return `
      <section class="panel">
        <h1 class="h1">Shop</h1>
        <p class="sub">Spend coins on cosmetics. (All local — no real money.)</p>

        <div class="notice">
          Your balance: <b>${user.coins} 🪙</b>
          <div class="helper">Buy items → then equip them in <span class="kbd">Inventory</span>.</div>
        </div>

        <div class="hr"></div>

        <div class="shopGrid">
          ${SHOP_ITEMS.map(item => {
            const isOwned = ownedIds.has(item.id);
            const canBuy = user.coins >= item.price;
            const preview = item.type === "frame"
              ? `<div class="miniAvatar ${item.cssClass}">Frame</div>`
              : `<div class="miniAvatar">Theme</div>`;
            return `
              <div class="item" data-item="${item.id}">
                <div class="name">${escapeHtml(item.name)}</div>
                <div class="desc">${escapeHtml(item.desc)}</div>
                <div class="preview">${preview}</div>
                <div class="price">Price: <b>${item.price} 🪙</b></div>
                ${isOwned
                  ? `<button class="btn" disabled>Owned</button>`
                  : `<button class="btn primary" data-buy="${item.id}" ${canBuy ? "" : "disabled"}>${canBuy ? "Buy" : "Not enough coins"}</button>`
                }
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderInventory(user) {
    const frames = user.owned.frames;
    const themes = user.owned.themes;

    const frameRows = frames.length ? frames.map(f => {
      const item = SHOP_ITEMS.find(x => x.type === "frame" && x.cssClass === f);
      const equipped = user.equipped.frame === f;
      return `
        <tr>
          <td><b>${escapeHtml(item?.name || f)}</b><div class="helper">${escapeHtml(item?.desc || "")}</div></td>
          <td><span class="badge">Frame</span></td>
          <td>${equipped ? `<span class="badge good">Equipped</span>` : `<span class="badge">Owned</span>`}</td>
          <td>
            ${equipped ? `<button class="btn small" data-unequip="frame">Unequip</button>`
                      : `<button class="btn small primary" data-equip-frame="${escapeHtml(f)}">Equip</button>`}
          </td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="4"><span class="helper">No frames owned yet. Visit the Shop.</span></td></tr>`;

    const themeRows = themes.length ? themes.map(t => {
      const item = SHOP_ITEMS.find(x => x.type === "theme" && x.theme === t);
      const equipped = user.equipped.theme === t;
      return `
        <tr>
          <td><b>${escapeHtml(item?.name || t)}</b><div class="helper">${escapeHtml(item?.desc || "")}</div></td>
          <td><span class="badge">Theme</span></td>
          <td>${equipped ? `<span class="badge good">Equipped</span>` : `<span class="badge">Owned</span>`}</td>
          <td>
            ${equipped ? `<button class="btn small" data-unequip="theme">Unequip</button>`
                      : `<button class="btn small primary" data-equip-theme="${escapeHtml(t)}">Equip</button>`}
          </td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="4"><span class="helper">No themes owned yet. Visit the Shop.</span></td></tr>`;

    return `
      <section class="panel">
        <h1 class="h1">Inventory</h1>
        <p class="sub">Equip your cosmetics: frames + themes.</p>

        <div class="panel" style="margin:0;">
          <h2 class="h1" style="font-size:16px;">Owned Frames</h2>
          <table class="table">
            <thead><tr><th>Item</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${frameRows}</tbody>
          </table>

          <div class="hr"></div>

          <h2 class="h1" style="font-size:16px;">Owned Themes</h2>
          <table class="table">
            <thead><tr><th>Item</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${themeRows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderAchievements(user) {
    const unlocked = new Set(user.achievements);

    return `
      <section class="panel">
        <h1 class="h1">Achievements</h1>
        <p class="sub">Unlock milestones while leveling up.</p>

        <div class="panel" style="margin:0;">
          <table class="table">
            <thead><tr><th>Achievement</th><th>Description</th><th>Status</th></tr></thead>
            <tbody>
              ${ACHIEVEMENTS.map(a => {
                const has = unlocked.has(a.id);
                return `
                  <tr>
                    <td><b>${escapeHtml(a.icon)} ${escapeHtml(a.name)}</b></td>
                    <td class="helper">${escapeHtml(a.desc)}</td>
                    <td>${has ? `<span class="badge good">Unlocked</span>` : `<span class="badge">Locked</span>`}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderLeaderboard(user) {
    const rows = state.users
      .map(u => {
        const lvl = levelFromXp(u.xp);
        const score = Math.floor(u.xp + u.totalQuestsCompleted * 25 + u.streak * 15 + u.coins * 0.2);
        return {
          id: u.id,
          username: u.username,
          level: lvl,
          xp: u.xp,
          quests: u.totalQuestsCompleted,
          streak: u.streak,
          score
        };
      })
      .sort((a,b) => b.score - a.score)
      .slice(0, 20);

    return `
      <section class="panel">
        <h1 class="h1">Leaderboard</h1>
        <p class="sub">Top adventurers on <b>this device</b>. (Local leaderboard.)</p>

        <div class="panel" style="margin:0;">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Level</th>
                <th>XP</th>
                <th>Quests</th>
                <th>Streak</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r, idx) => `
                <tr>
                  <td><b>${idx + 1}</b></td>
                  <td>${escapeHtml(r.username)} ${r.id === user.id ? `<span class="badge good">You</span>` : ""}</td>
                  <td>${r.level}</td>
                  <td>${r.xp}</td>
                  <td>${r.quests}</td>
                  <td>${r.streak}🔥</td>
                  <td><b>${r.score}</b></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="helper">Score = XP + quests + streak + (coins/5). Just for fun.</div>
        </div>
      </section>
    `;
  }

  function renderProfile(user) {
    const frameClass = avatarFrameClass(user);
    const avatarSrc = user.avatarDataUrl
      ? `<img alt="Profile picture" src="${user.avatarDataUrl}">`
      : `<div class="miniAvatar">No Pic</div>`;

    return `
      <section class="panel">
        <h1 class="h1">Profile</h1>
        <p class="sub">Customize your identity and vibe.</p>

        <div class="split">
          <div class="panel" style="margin:0;">
            <h2 class="h1" style="font-size:16px;">Player Card</h2>
            <div class="userCard" style="margin-top:10px;">
              <div class="avatar ${frameClass}" style="width:74px; height:74px; border-radius: 22px;">
                ${avatarSrc}
              </div>
              <div class="userMeta">
                <b>${escapeHtml(user.username)}</b>
                <span>${escapeHtml(user.email)}</span>
                <span style="margin-top:6px;">${escapeHtml(user.bio || "No bio yet. Add one!")}</span>
              </div>
            </div>

            <div class="hr"></div>

            <div class="field">
              <label>Username</label>
              <input id="pfUsername" value="${escapeHtml(user.username)}" maxlength="24">
            </div>

            <div class="field" style="margin-top:10px;">
              <label>Bio</label>
              <textarea id="pfBio" maxlength="140" placeholder="A short bio...">${escapeHtml(user.bio || "")}</textarea>
              <div class="helper">Keep it short and cool (max 140 chars).</div>
            </div>

            <div class="row" style="margin-top:10px;">
              <button class="btn primary" id="btnSaveProfile">Save Profile</button>
              <button class="btn danger" id="btnClearAvatar">Remove Profile Picture</button>
            </div>
          </div>

          <div class="panel" style="margin:0;">
            <h2 class="h1" style="font-size:16px;">Profile Picture</h2>
            <p class="sub">Upload a photo. We auto-crop it to a square.</p>

            <div class="field">
              <label>Upload Image</label>
              <input type="file" id="pfAvatarFile" accept="image/*">
              <div class="helper">Tip: use a clear face picture for best results.</div>
            </div>

            <div class="hr"></div>

            <div class="notice">
              Frames can be bought in the <span class="kbd">Shop</span> and equipped in <span class="kbd">Inventory</span>.
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderSettings(user) {
    return `
      <section class="panel">
        <h1 class="h1">Settings</h1>
        <p class="sub">Export/import your save or reset data (careful!).</p>

        <div class="panel" style="margin:0;">
          <div class="row">
            <button class="btn" id="btnExport">Export Save (JSON)</button>
            <label class="btn" style="display:flex; align-items:center; justify-content:center; gap:8px;">
              Import Save
              <input id="importFile" type="file" accept="application/json" style="display:none;">
            </label>
          </div>

          <div class="hr"></div>

          <div class="notice">
            <b>Reset options</b>
            <div class="helper">These actions cannot be undone.</div>
          </div>

          <div class="row" style="margin-top:10px;">
            <button class="btn danger" id="btnResetAccount">Reset My Account (quests/stats)</button>
            <button class="btn danger" id="btnDeleteAccount">Delete My Account</button>
            <button class="btn danger" id="btnFactoryReset">Factory Reset (delete ALL users)</button>
          </div>
        </div>
      </section>
    `;
  }

  // ----- Auth UI -----
  function renderAuth() {
    return `
      <div class="topbar">
        <div class="inner">
          <div class="brand">
            <div class="logo" aria-hidden="true"></div>
            <div class="title">
              <b>QuestTrack RPG</b>
              <span>Sign in to start earning XP</span>
            </div>
          </div>
          <div class="chipRow">
            <span class="chip"><small>Local Demo</small><b>✅</b></span>
          </div>
        </div>
      </div>

      <div class="authWrap">
        <div class="authGrid">
          <div class="hero">
            <div>
              <h2>Turn your tasks into a game.</h2>
              <p>Quests give XP. XP gives levels. Coins unlock cosmetics. Streaks build consistency.</p>
              <div class="pills">
                <span class="pill">✅ Dashboard</span>
                <span class="pill">📜 Quests</span>
                <span class="pill">🪙 Shop</span>
                <span class="pill">🖼️ Profile Pic</span>
                <span class="pill">🏆 Achievements</span>
                <span class="pill">📈 Leaderboard</span>
              </div>
            </div>
            <div class="tip">
              <b>Tip:</b> Use “Forgot Password” if you remember your security answer.
              <div class="helper">No real emails are sent — this is a portfolio-style local app.</div>
            </div>
          </div>

          <div class="formCard">
            <div class="tabs" id="authTabs">
              <button data-tab="login" class="active">Login</button>
              <button data-tab="register">Register</button>
              <button data-tab="forgot">Forgot</button>
            </div>

            <div id="authBody" style="margin-top:14px;">
              ${renderAuthLogin()}
            </div>

            <div class="helper" style="margin-top:12px;">
              This app stores data in <span class="kbd">localStorage</span> on your device.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAuthLogin() {
    return `
      <h1 class="h1">Log in</h1>
      <p class="sub">Welcome back, adventurer.</p>
      <div class="field">
        <label>Email</label>
        <input id="liEmail" type="email" placeholder="you@example.com" autocomplete="email">
      </div>
      <div class="field" style="margin-top:10px;">
        <label>Password</label>
        <input id="liPass" type="password" placeholder="••••••••" autocomplete="current-password">
      </div>

      <div class="row" style="margin-top:12px;">
        <button class="btn primary" id="btnLogin">Login</button>
        <button class="btn" id="btnGoForgot">Forgot Password</button>
      </div>

      <div class="hr"></div>

      <div class="notice">
        No account yet? Go to <b>Register</b> tab.
      </div>
    `;
  }

  function renderAuthRegister() {
    return `
      <h1 class="h1">Register</h1>
      <p class="sub">Create your character.</p>

      <div class="row">
        <div class="field">
          <label>Username</label>
          <input id="reUser" placeholder="e.g., Enzo" maxlength="24" autocomplete="nickname">
        </div>
        <div class="field">
          <label>Email</label>
          <input id="reEmail" type="email" placeholder="you@example.com" autocomplete="email">
        </div>
      </div>

      <div class="row" style="margin-top:10px;">
        <div class="field">
          <label>Password</label>
          <input id="rePass" type="password" placeholder="Create a password" autocomplete="new-password">
        </div>
        <div class="field">
          <label>Confirm Password</label>
          <input id="rePass2" type="password" placeholder="Repeat password" autocomplete="new-password">
        </div>
      </div>

      <div class="hr"></div>

      <div class="field">
        <label>Security Question (for password reset)</label>
        <input id="reSecQ" placeholder="e.g., What is my favorite food?" maxlength="80">
      </div>

      <div class="field" style="margin-top:10px;">
        <label>Security Answer</label>
        <input id="reSecA" placeholder="e.g., adobo" maxlength="60">
        <div class="helper">Remember this. It’s required for “Forgot Password”.</div>
      </div>

      <div class="row" style="margin-top:12px;">
        <button class="btn primary" id="btnRegister">Create Account</button>
      </div>
    `;
  }

  function renderAuthForgot() {
    return `
      <h1 class="h1">Forgot Password</h1>
      <p class="sub">Reset using your security answer.</p>

      <div class="field">
        <label>Email</label>
        <input id="fpEmail" type="email" placeholder="you@example.com" autocomplete="email">
      </div>

      <div class="row" style="margin-top:10px;">
        <button class="btn" id="btnLoadQuestion">Load Security Question</button>
      </div>

      <div id="fpQuestionWrap" class="hidden" style="margin-top:12px;">
        <div class="notice">
          <b>Question:</b> <span id="fpQuestionText"></span>
        </div>

        <div class="field" style="margin-top:10px;">
          <label>Your Answer</label>
          <input id="fpAnswer" placeholder="Type your answer">
        </div>

        <div class="field" style="margin-top:10px;">
          <label>New Password</label>
          <input id="fpNewPass" type="password" placeholder="New password">
        </div>

        <div class="row" style="margin-top:12px;">
          <button class="btn primary" id="btnResetPass">Reset Password</button>
        </div>
      </div>
    `;
  }

  // ----- Bindings -----
  function bindAuth() {
    const tabs = $("#authTabs");
    const body = $("#authBody");

    function setTab(tab) {
      $$("#authTabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
      if (tab === "login") body.innerHTML = renderAuthLogin();
      if (tab === "register") body.innerHTML = renderAuthRegister();
      if (tab === "forgot") body.innerHTML = renderAuthForgot();
      bindAuthBody(tab);
    }

    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      setTab(btn.dataset.tab);
    });

    bindAuthBody("login");
    function bindAuthBody(tab) {
      if (tab === "login") {
        $("#btnLogin")?.addEventListener("click", onLogin);
        $("#btnGoForgot")?.addEventListener("click", () => setTab("forgot"));
        // Enter key
        $("#liPass")?.addEventListener("keydown", (e) => { if (e.key === "Enter") onLogin(); });
      }
      if (tab === "register") {
        $("#btnRegister")?.addEventListener("click", onRegister);
      }
      if (tab === "forgot") {
        $("#btnLoadQuestion")?.addEventListener("click", onForgotLoadQuestion);
        // will bind reset after question loaded
      }
    }
  }

  function bindApp() {
    // Side nav + bottom nav
    $("#sideNav")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (!btn) return;
      ui.page = btn.dataset.page;
      render();
    });
    $(".bottomNav")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (!btn) return;
      ui.page = btn.dataset.page;
      render();
    });

    $("#btnLogout")?.addEventListener("click", () => {
      state.session.currentUserId = null;
      saveState();
      toast("Logged out.", "good");
      render();
    });

    // Page-specific bindings
    const user = getCurrentUser();
    if (!user) return;

    if (ui.page === "dashboard") {
      $("#btnQuickAdd")?.addEventListener("click", () => {
        const title = ($("#qaTitle")?.value || "").trim();
        const diff = $("#qaDiff")?.value || "Medium";
        const notes = ($("#qaNotes")?.value || "").trim();
        addQuest(user, title, diff, notes);
      });
      $("#btnGoQuests")?.addEventListener("click", () => { ui.page = "quests"; render(); });
    }

    if (ui.page === "quests") {
      $("#btnAddQuest")?.addEventListener("click", () => {
        const title = ($("#qTitle")?.value || "").trim();
        const diff = $("#qDiff")?.value || "Medium";
        const notes = ($("#qNotes")?.value || "").trim();
        addQuest(user, title, diff, notes);
      });

      $("#btnAddExample")?.addEventListener("click", () => {
        const samples = [
          ["Clean your room (10 mins)", "Easy", "Just do a quick reset."],
          ["Study 30 minutes", "Medium", "Focus session, no phone."],
          ["Finish project milestone", "Hard", "Break into steps."],
          ["Deep clean + organize desk", "Epic", "Reward yourself after."],
        ];
        samples.forEach(s => addQuest(user, s[0], s[1], s[2], true));
        saveState();
        toast("Example quests added!", "good");
        render();
      });

      $("#qFilter")?.addEventListener("change", (e) => {
        ui.questFilter = e.target.value;
        render();
      });

      $("#qSearch")?.addEventListener("input", (e) => {
        ui.questSearch = e.target.value;
        render();
      });

      $("#questTable")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const tr = e.target.closest("tr[data-qid]");
        if (!tr) return;
        const qid = tr.dataset.qid;
        const action = btn.dataset.action;

        if (action === "complete") completeQuest(user, qid);
        if (action === "undo") undoQuest(user, qid);
        if (action === "delete") deleteQuest(user, qid);
        if (action === "edit") editQuest(user, qid);
      });
    }

    if (ui.page === "shop") {
      root.addEventListener("click", onShopClick, { once: true });
      // Using once to avoid multiple listeners on re-render; we re-bind each render anyway.
    }

    if (ui.page === "inventory") {
      root.addEventListener("click", onInventoryClick, { once: true });
    }

    if (ui.page === "profile") {
      $("#btnSaveProfile")?.addEventListener("click", () => {
        const newName = ($("#pfUsername")?.value || "").trim();
        const newBio = ($("#pfBio")?.value || "").trim();

        if (newName.length < 2) return toast("Username too short.", "bad");
        if (newName.length > 24) return toast("Username too long.", "bad");

        // ensure unique username (optional, local)
        const clash = state.users.some(u => u.id !== user.id && u.username.toLowerCase() === newName.toLowerCase());
        if (clash) return toast("That username is taken on this device.", "bad");

        user.username = newName;
        user.bio = newBio.slice(0, 140);
        addActivity(user, "Updated profile.");
        evaluateAchievements(user);
        saveState();
        toast("Profile saved!", "good");
        render();
      });

      $("#btnClearAvatar")?.addEventListener("click", () => {
        user.avatarDataUrl = null;
        addActivity(user, "Removed profile picture.");
        evaluateAchievements(user);
        saveState();
        toast("Profile picture removed.", "good");
        render();
      });

      $("#pfAvatarFile")?.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const dataUrl = await fileToDataUrl(file);
          const square = await cropToSquareDataUrl(dataUrl, 256);
          user.avatarDataUrl = square;
          addActivity(user, "Set a new profile picture.");
          evaluateAchievements(user);
          saveState();
          toast("Profile picture updated!", "good");
          render();
        } catch {
          toast("Could not process image.", "bad");
        } finally {
          e.target.value = "";
        }
      });
    }

    if (ui.page === "settings") {
      $("#btnExport")?.addEventListener("click", () => exportSave());
      $("#importFile")?.addEventListener("change", (e) => importSave(e));

      $("#btnResetAccount")?.addEventListener("click", () => {
        if (!confirm("Reset your quests and stats?")) return;
        const keep = { id:user.id, username:user.username, email:user.email, passHash:user.passHash, security:user.security, created:user.created };
        const replacement = defaultUser({
          username: keep.username,
          email: keep.email,
          password: "temp",
          secQ: keep.security.q,
          secA: "temp"
        });
        // restore fixed identity/security
        replacement.id = keep.id;
        replacement.passHash = keep.passHash;
        replacement.security = keep.security;
        replacement.created = keep.created;
        // keep cosmetics/profile pic
        replacement.avatarDataUrl = user.avatarDataUrl;
        replacement.bio = user.bio;
        replacement.owned = user.owned;
        replacement.equipped = user.equipped;
        replacement.coins = user.coins; // keep coins

        const idx = state.users.findIndex(u => u.id === user.id);
        state.users[idx] = replacement;
        saveState();
        toast("Account reset done.", "good");
        render();
      });

      $("#btnDeleteAccount")?.addEventListener("click", () => {
        if (!confirm("Delete your account from this device?")) return;
        state.users = state.users.filter(u => u.id !== user.id);
        state.session.currentUserId = null;
        saveState();
        toast("Account deleted.", "good");
        render();
      });

      $("#btnFactoryReset")?.addEventListener("click", () => {
        if (!confirm("Factory reset deletes ALL users from this device. Continue?")) return;
        localStorage.removeItem(LS_KEY);
        toast("Factory reset complete.", "good");
        location.reload();
      });
    }
  }

  // ----- Auth handlers -----
  function onRegister() {
    const username = ($("#reUser")?.value || "").trim();
    const email = ($("#reEmail")?.value || "").trim().toLowerCase();
    const pass = ($("#rePass")?.value || "");
    const pass2 = ($("#rePass2")?.value || "");
    const secQ = ($("#reSecQ")?.value || "").trim();
    const secA = ($("#reSecA")?.value || "").trim();

    if (username.length < 2) return toast("Username must be at least 2 characters.", "bad");
    if (!email.includes("@") || email.length < 6) return toast("Enter a valid email.", "bad");
    if (pass.length < 6) return toast("Password must be at least 6 characters.", "bad");
    if (pass !== pass2) return toast("Passwords do not match.", "bad");
    if (secQ.length < 8) return toast("Security question is too short.", "bad");
    if (secA.length < 2) return toast("Security answer is too short.", "bad");

    const exists = state.users.some(u => u.email === email);
    if (exists) return toast("That email is already registered.", "bad");

    const user = defaultUser({ username, email, password: pass, secQ, secA });
    addActivity(user, "Created an account.");
    state.users.push(user);
    state.session.currentUserId = user.id;
    state.session.lastHelloForUserId = null;
    user.lastLoginDate = nowISODate();
    saveState();
    toast("Account created! Welcome!", "good");
    render();
  }

  function onLogin() {
    const email = ($("#liEmail")?.value || "").trim().toLowerCase();
    const pass = ($("#liPass")?.value || "");
    const user = state.users.find(u => u.email === email);
    if (!user) return toast("No account found for that email.", "bad");
    if (user.passHash !== weakHash(pass)) return toast("Incorrect password.", "bad");

    state.session.currentUserId = user.id;
    state.session.lastHelloForUserId = null;
    user.lastLoginDate = nowISODate();
    addActivity(user, "Logged in.");
    saveState();
    toast("Logged in!", "good");
    render();
  }

  function onForgotLoadQuestion() {
    const email = ($("#fpEmail")?.value || "").trim().toLowerCase();
    const user = state.users.find(u => u.email === email);
    if (!user) return toast("No account found for that email.", "bad");

    $("#fpQuestionWrap")?.classList.remove("hidden");
    $("#fpQuestionText").textContent = user.security.q;

    $("#btnResetPass")?.addEventListener("click", () => {
      const ans = ($("#fpAnswer")?.value || "").trim().toLowerCase();
      const newPass = ($("#fpNewPass")?.value || "");
      if (newPass.length < 6) return toast("New password must be at least 6 characters.", "bad");
      if (weakHash(ans) !== user.security.aHash) return toast("Security answer is wrong.", "bad");

      user.passHash = weakHash(newPass);
      addActivity(user, "Reset password using security question.");
      saveState();
      toast("Password reset! You can log in now.", "good");
      // Switch to login tab
      const tabs = $("#authTabs");
      tabs?.querySelector('button[data-tab="login"]')?.click();
    }, { once: true });
  }

  // ----- Quest actions -----
  function addQuest(user, title, diff, notes, silent = false) {
    if (title.length < 3) {
      if (!silent) toast("Quest title is too short.", "bad");
      return;
    }
    const quest = {
      id: uid(),
      title: title.slice(0, 80),
      notes: (notes || "").slice(0, 240),
      difficulty: diff,
      createdAt: nowISODate(),
      completedAt: null,
    };
    user.quests.unshift(quest);
    addActivity(user, `Added quest: ${quest.title}`);
    saveState();
    if (!silent) toast("Quest added!", "good");
    render();
  }

  function completeQuest(user, qid) {
    const quest = user.quests.find(q => q.id === qid);
    if (!quest || quest.completedAt) return;

    quest.completedAt = nowISODate();
    const r = difficultyRewards(quest.difficulty);

    // streak logic
    const today = nowISODate();
    if (!user.lastActiveDate) {
      user.streak = 1;
    } else {
      const diff = daysBetween(user.lastActiveDate, today);
      if (diff === 0) {
        // already active today; keep streak
      } else if (diff === 1) {
        user.streak += 1;
      } else if (diff > 1) {
        user.streak = 1;
      }
    }
    user.lastActiveDate = today;

    const beforeLvl = levelFromXp(user.xp);
    user.xp += r.xp;
    user.coins += r.coins;
    user.totalCoinsEarned += r.coins;
    user.totalQuestsCompleted += 1;

    const afterLvl = levelFromXp(user.xp);
    if (afterLvl > beforeLvl) {
      toast(`LEVEL UP! You're now level ${afterLvl}`, "good", "Keep going!");
      addActivity(user, `Leveled up to ${afterLvl}.`);
      // small bonus
      const bonus = 50 + (afterLvl * 5);
      user.coins += bonus;
      addActivity(user, `Received level-up bonus: +${bonus} coins.`);
    }

    addActivity(user, `Completed quest: ${quest.title} (+${r.xp} XP, +${r.coins} coins)`);
    evaluateAchievements(user);
    saveState();
    toast("Quest completed!", "good", `+${r.xp} XP • +${r.coins} 🪙`);
    render();
  }

  function undoQuest(user, qid) {
    const quest = user.quests.find(q => q.id === qid);
    if (!quest || !quest.completedAt) return;

    // Undo does not remove awarded XP/coins (keeps things simple).
    // It only marks the quest active again.
    quest.completedAt = null;
    addActivity(user, `Reopened quest: ${quest.title}`);
    saveState();
    toast("Quest reopened.", "good");
    render();
  }

  function deleteQuest(user, qid) {
    const quest = user.quests.find(q => q.id === qid);
    if (!quest) return;

    if (!confirm(`Delete quest "${quest.title}"?`)) return;
    user.quests = user.quests.filter(q => q.id !== qid);
    addActivity(user, `Deleted quest: ${quest.title}`);
    saveState();
    toast("Quest deleted.", "good");
    render();
  }

  function editQuest(user, qid) {
    const quest = user.quests.find(q => q.id === qid);
    if (!quest) return;

    const newTitle = prompt("Edit quest title:", quest.title);
    if (newTitle === null) return;
    const t = newTitle.trim();
    if (t.length < 3) return toast("Title too short.", "bad");

    const newNotes = prompt("Edit notes (optional):", quest.notes || "");
    if (newNotes === null) return;

    quest.title = t.slice(0, 80);
    quest.notes = newNotes.trim().slice(0, 240);

    addActivity(user, `Edited quest: ${quest.title}`);
    saveState();
    toast("Quest updated.", "good");
    render();
  }

  // ----- Shop / Inventory -----
  function onShopClick(e) {
    const buyBtn = e.target.closest("button[data-buy]");
    if (!buyBtn) { bindApp(); return; } // rebind for other page listeners
    const itemId = buyBtn.dataset.buy;
    const user = getCurrentUser();
    if (!user) return;

    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    if (user.coins < item.price) return toast("Not enough coins.", "bad");

    // ownership
    if (item.type === "frame") {
      if (user.owned.frames.includes(item.cssClass)) return toast("Already owned.", "bad");
      user.owned.frames.push(item.cssClass);
    } else {
      if (user.owned.themes.includes(item.theme)) return toast("Already owned.", "bad");
      user.owned.themes.push(item.theme);
    }

    user.coins -= item.price;
    addActivity(user, `Bought: ${item.name} (-${item.price} coins)`);
    evaluateAchievements(user);
    saveState();
    toast("Purchased!", "good", item.name);
    render();
  }

  function onInventoryClick(e) {
    const user = getCurrentUser();
    if (!user) return;

    const ef = e.target.closest("button[data-equip-frame]");
    const et = e.target.closest("button[data-equip-theme]");
    const un = e.target.closest("button[data-unequip]");

    if (ef) {
      const frame = ef.dataset.equipFrame;
      if (!user.owned.frames.includes(frame)) return toast("You don't own that frame.", "bad");
      user.equipped.frame = frame;
      addActivity(user, `Equipped frame.`);
      saveState();
      toast("Frame equipped!", "good");
      render();
      return;
    }

    if (et) {
      const theme = et.dataset.equipTheme;
      if (!user.owned.themes.includes(theme)) return toast("You don't own that theme.", "bad");
      user.equipped.theme = theme;
      addActivity(user, `Equipped theme.`);
      saveState();
      toast("Theme equipped!", "good");
      render();
      return;
    }

    if (un) {
      const type = un.dataset.unequip;
      if (type === "frame") user.equipped.frame = null;
      if (type === "theme") user.equipped.theme = null;
      addActivity(user, `Unequipped ${type}.`);
      saveState();
      toast("Unequipped.", "good");
      render();
      return;
    }
  }

  // ----- Export / Import -----
  function exportSave() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "questtrack_rpg_save.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast("Save exported.", "good");
  }

  function importSave(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.users)) {
          toast("Invalid save file.", "bad");
          return;
        }
        // light validation
        state.users = parsed.users;
        state.session = parsed.session || { currentUserId: null, lastHelloForUserId: null };
        saveState();
        toast("Save imported!", "good");
        render();
      } catch {
        toast("Could not import save file.", "bad");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  // ----- Image helpers (avatar crop) -----
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function cropToSquareDataUrl(dataUrl, size = 256) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("no ctx"));

          // center-crop to square
          const w = img.width;
          const h = img.height;
          const s = Math.min(w, h);
          const sx = Math.floor((w - s) / 2);
          const sy = Math.floor((h - s) / 2);

          ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
          resolve(canvas.toDataURL("image/png", 0.92));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  // ----- Boot -----
  // Ensure session user still exists
  const cu = getCurrentUser();
  if (!cu) {
    state.session.currentUserId = null;
    saveState();
  } else {
    evaluateAchievements(cu);
    saveState();
  }

  render();
})();
