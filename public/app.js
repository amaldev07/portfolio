(() => {
  'use strict';

  const STORAGE_KEY = 'amaldev-quest-v1';
  const QUESTS = {
    explore: { label: 'Meet the developer', xp: 25 },
    project: { label: 'Inspect a project', xp: 50 },
    skills: { label: 'Equip a skill loadout', xp: 25 },
    terminal: { label: 'Run a terminal command', xp: 25 },
    contact: { label: 'Find the contact station', xp: 25 },
    'crystal-1': { label: 'First crystal collected', xp: 25 },
    'crystal-2': { label: 'Second crystal collected', xp: 25 },
    'crystal-3': { label: 'Third crystal collected', xp: 25 }
  };

  const PROJECTS = {
    amavya: {
      title: 'Amavya.shop',
      description: 'A jewelry e-commerce experience with a Firebase-powered admin dashboard, Cloudinary image management, a Spring Boot backend, and GitHub Actions deployments.',
      stack: ['E-commerce', 'Firebase', 'Cloudinary', 'Spring Boot', 'GitHub Actions'],
      url: 'https://amavya.shop'
    },
    crm: {
      title: 'Smart CRM',
      description: 'A customer relationship management interface for keeping customers, sales, and everyday business operations in one place.',
      stack: ['CRM', 'Dashboard', 'Web application'],
      url: 'https://amaldev07.github.io/crm_demo/',
      source: 'https://github.com/amaldev07/crm_demo'
    },
    coffee: {
      title: 'Koffora Coffee',
      description: 'A coffee brand website that brings the menu, the atmosphere, and the story of Koffora together in a responsive experience.',
      stack: ['Responsive web', 'UI development', 'Brand experience'],
      url: 'https://amaldev07.github.io/kofforacoffee/',
      source: 'https://github.com/amaldev07/kofforacoffee'
    },
    academic: {
      title: 'Academic Project Centre',
      description: 'A website for an academic project centre, helping students discover project support and connect with the team.',
      stack: ['Responsive web', 'Education', 'UI development'],
      url: 'https://amaldev07.github.io/academic-project-centre',
      source: 'https://github.com/amaldev07/academic-project-centre'
    },
    extension: {
      title: 'LinkedIn Auto-Greeting',
      description: 'A browser extension that makes everyday LinkedIn replies faster with reusable greeting templates and one-click responses.',
      stack: ['Browser extension', 'JavaScript', 'Productivity'],
      url: 'https://github.com/amaldev07/linkedin-reply-plugin',
      source: 'https://github.com/amaldev07/linkedin-reply-plugin'
    },
    search: {
      title: 'Search Application',
      description: 'An Angular search experiment exploring debouncing, caching, and state management to keep results responsive as a user types.',
      stack: ['Angular', 'Debouncing', 'Caching', 'State management']
    },
    access: {
      title: 'Role-Based Access App',
      description: 'A React interface experiment for making roles and permissions easier to understand through a visual representation of access rules.',
      stack: ['React', 'Permissions', 'Data visualization']
    }
  };

  const LOADOUTS = {
    frontend: {
      title: 'The interface builder',
      description: 'The tools I reach for to turn complex requirements into fast, intuitive interfaces.'
    },
    architecture: {
      title: 'Systems thinker',
      description: 'Patterns and foundations for applications that stay maintainable as they grow.'
    },
    tooling: {
      title: 'Build & ship',
      description: 'The workflow behind the interface: version control, testing, delivery, and the details that make shipping reliable.'
    }
  };

  function init() {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let saved = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (parsed && typeof parsed === 'object') saved = parsed;
    } catch { /* The site remains playable without browser storage. */ }

    const completed = new Set(
      (Array.isArray(saved.completed) ? saved.completed : [])
        .filter((id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(QUESTS, id))
    );
    let soundEnabled = saved.sound === true;
    let audioContext;
    let toastTimer;
    let lastActiveSection;
    let resetArmed = false;
    const commandHistory = [];
    let historyIndex = 0;
    let historyDraft = '';

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          completed: Array.from(completed),
          sound: soundEnabled
        }));
      } catch { /* Private browsing and blocked storage do not block interactions. */ }
    }

    function progress() {
      const xp = Array.from(completed).reduce((sum, id) => sum + QUESTS[id].xp, 0);
      return { completed: Array.from(completed), xp, level: Math.floor(xp / 100) + 1 };
    }

    function emitProgress() {
      document.dispatchEvent(new CustomEvent('portfolio:progress', { detail: progress() }));
    }

    function renderProgress() {
      const { xp, level } = progress();
      if ($('#xp-value')) $('#xp-value').textContent = String(xp);
      if ($('#player-level')) $('#player-level').textContent = String(level).padStart(2, '0');
      const bar = $('#xp-bar');
      if (bar) {
        bar.style.width = `${xp % 100}%`;
        const meter = bar.closest('[role="progressbar"], .xp-track') || bar;
        meter.setAttribute('role', 'progressbar');
        meter.setAttribute('aria-label', 'Progress to next explorer level');
        meter.setAttribute('aria-valuenow', String(xp % 100));
        meter.setAttribute('aria-valuemin', '0');
        meter.setAttribute('aria-valuemax', '100');
        meter.setAttribute('aria-valuetext', `${xp} total XP. Level ${level}. ${100 - xp % 100} XP to next level.`);
      }
      if ($('#quest-count')) $('#quest-count').textContent = `${completed.size} / ${Object.keys(QUESTS).length}`;
      $$('#quest-list [data-quest]').forEach((row) => {
        const done = completed.has(row.dataset.quest);
        row.classList.toggle('complete', done);
        const check = row.querySelector('.quest-check');
        if (check) {
          check.textContent = done ? '✓' : '○';
          check.setAttribute('aria-label', done ? 'Completed' : 'Incomplete');
        }
      });
      emitProgress();
    }

    function toast(message) {
      const element = $('#toast');
      if (!element) return;
      clearTimeout(toastTimer);
      element.textContent = message;
      element.hidden = false;
      element.classList.add('visible', 'show');
      toastTimer = setTimeout(() => {
        element.classList.remove('visible', 'show');
        element.hidden = true;
      }, reducedMotion.matches ? 4200 : 3600);
    }

    function unlockAudio() {
      if (!soundEnabled) return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      try {
        if (!audioContext) audioContext = new AudioContextClass();
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      } catch { /* Audio is an optional enhancement. */ }
    }

    function playAwardSound() {
      if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
      try {
        [523.25, 659.25, 783.99].forEach((frequency, index) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const startsAt = audioContext.currentTime + index * 0.07;
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, startsAt);
          gain.gain.linearRampToValueAtTime(0.035, startsAt + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.001, startsAt + 0.22);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start(startsAt);
          oscillator.stop(startsAt + 0.24);
        });
      } catch { /* Missing audio support never interrupts a quest. */ }
    }

    function award(id) {
      if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(QUESTS, id) || completed.has(id)) return false;
      const previousLevel = progress().level;
      completed.add(id);
      persist();
      renderProgress();
      playAwardSound();
      const levelUp = progress().level > previousLevel ? ` · Level ${progress().level} unlocked!` : '';
      toast(`+${QUESTS[id].xp} XP · ${QUESTS[id].label}${levelUp}`);
      return true;
    }

    function renderSound() {
      $$('[data-sound]').forEach((button) => button.setAttribute('aria-pressed', String(soundEnabled)));
      if ($('#sound-label')) $('#sound-label').textContent = soundEnabled ? 'On' : 'Off';
    }

    function setQuestPanel(open) {
      const panel = $('#quest-panel');
      if (!panel) return;
      panel.hidden = !open;
      $$('[data-quest-toggle]').forEach((button) => button.setAttribute('aria-expanded', String(open)));
    }

    function setMenu(open) {
      const menu = $('#mobile-nav');
      if (!menu) return;
      menu.hidden = !open;
      $$('[data-menu]').forEach((button) => button.setAttribute('aria-expanded', String(open)));
    }

    function setActiveSection(id) {
      if (lastActiveSection === id) return;
      lastActiveSection = id;
      $$('[data-nav]').forEach((link) => {
        const active = (link.dataset.nav || link.getAttribute('href')?.replace(/^#/, '')) === id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function navigate(section, focus = false) {
      const id = String(section || '').replace(/^#/, '');
      const target = document.getElementById(id);
      if (!target) return false;
      setMenu(false);
      setQuestPanel(false);
      target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
      setActiveSection(id);
      if (focus) {
        const heading = target.querySelector('h1, h2, h3') || target;
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
      if (id === 'about') award('explore');
      if (id === 'contact') award('contact');
      return true;
    }

    function openDialog(dialog) {
      if (!dialog || dialog.open) return;
      setQuestPanel(false);
      setMenu(false);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeDialog(dialog) {
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    function terminalLine(value, type = '') {
      const output = $('#terminal-output');
      if (!output) return;
      const line = document.createElement('div');
      line.className = `terminal-line${type ? ` ${type}` : ''}`;
      line.textContent = value;
      output.appendChild(line);
      while (output.children.length > 100) output.firstElementChild.remove();
      output.scrollTop = output.scrollHeight;
    }

    function openTerminal() {
      openDialog($('#terminal-dialog'));
      $('#terminal-input')?.focus();
    }

    function resetProgress() {
      completed.clear();
      persist();
      renderProgress();
      document.dispatchEvent(new CustomEvent('portfolio:reset'));
      toast('Fresh save started. Your next adventure is ready.');
    }

    function runCommand(raw) {
      const command = raw.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!command) return;
      terminalLine(`visitor@amaldev:~$ ${raw.trim()}`, 'terminal-echo');
      if (commandHistory[commandHistory.length - 1] !== raw.trim()) commandHistory.push(raw.trim());
      if (commandHistory.length > 50) commandHistory.shift();
      historyIndex = commandHistory.length;
      historyDraft = '';

      if (command === 'reset confirm' && resetArmed) {
        resetArmed = false;
        resetProgress();
        terminalLine('Progress reset. A fresh save is ready.');
        return;
      }
      if (command !== 'reset') resetArmed = false;

      const sectionCommands = { about: 'about', projects: 'projects', skills: 'skills', contact: 'contact' };
      if (Object.prototype.hasOwnProperty.call(sectionCommands, command)) {
        award('terminal');
        terminalLine(`Opening ${command}…`);
        closeDialog($('#terminal-dialog'));
        navigate(sectionCommands[command], true);
        return;
      }

      switch (command) {
        case 'help':
          terminalLine('Available commands:\n  about      Meet the developer\n  projects   Explore selected work\n  skills     Choose your loadout\n  contact    Start a conversation\n  resume     Open my résumé\n  theme      Switch day / night\n  coffee     Take a coffee break\n  clear      Clear this terminal\n  reset      Start a fresh save\n\nTip: ↑ / ↓ recalls commands. Esc closes the terminal.');
          break;
        case 'resume':
          window.open('Resume_Amaldev.pdf', '_blank', 'noopener,noreferrer');
          terminalLine('Opening résumé in a new tab. You can also use the résumé link on this page.');
          break;
        case 'clear':
          if ($('#terminal-output')) $('#terminal-output').textContent = '';
          break;
        case 'theme': {
          const theme = document.documentElement.dataset.theme === 'day' ? 'night' : 'day';
          document.documentElement.dataset.theme = theme;
          terminalLine(`${theme === 'day' ? 'Day' : 'Night'} mode activated.`);
          break;
        }
        case 'coffee':
          terminalLine('     ( (\n      ) )\n   .-------.\n   |       |]  +10 imaginary energy\n   \\_______/\n\nCoffee acquired. Let’s build something good.');
          break;
        case 'reset':
          resetArmed = true;
          terminalLine('This clears your saved quest progress. Type “reset confirm” to continue, or any other command to cancel.');
          return;
        default:
          terminalLine(`Command not found: ${raw.trim()}. Type “help” to see what you can do.`, 'terminal-error');
          return;
      }
      award('terminal');
    }

    function openProject(id) {
      const project = PROJECTS[id];
      if (!project) return;
      if ($('#project-title')) $('#project-title').textContent = project.title;
      if ($('#project-description')) $('#project-description').textContent = project.description;
      const stack = $('#project-stack');
      if (stack) {
        stack.replaceChildren(...project.stack.map((technology) => {
          const tag = document.createElement('span');
          tag.textContent = technology;
          return tag;
        }));
      }
      [['#project-link', project.url], ['#project-source', project.source]].forEach(([selector, url]) => {
        const link = $(selector);
        if (!link) return;
        link.hidden = !url;
        if (url) {
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        } else link.removeAttribute('href');
      });
      openDialog($('#project-dialog'));
      award('project');
    }

    function setLoadout(id, reward = true) {
      const loadout = LOADOUTS[id];
      if (!loadout) return;
      $$('[data-loadout]').forEach((button) => {
        const selected = button.dataset.loadout === id;
        button.setAttribute('aria-pressed', String(selected));
        button.classList.toggle('active', selected);
      });
      if ($('#loadout-title')) $('#loadout-title').textContent = loadout.title;
      if ($('#loadout-description')) $('#loadout-description').textContent = loadout.description;
      let count = 0;
      $$('.skill-item').forEach((item) => {
        const equipped = (item.dataset.groups || '').split(/[\s,]+/).includes(id);
        item.classList.toggle('equipped', equipped);
        if (equipped) count += 1;
      });
      if ($('#loadout-count')) $('#loadout-count').textContent = String(count);
      if (reward) award('skills');
    }

    function filterProjects(category) {
      $$('[data-filter]').forEach((button) => {
        const selected = button.dataset.filter === category;
        button.setAttribute('aria-pressed', String(selected));
        button.classList.toggle('active', selected);
      });
      $$('.project-card').forEach((card) => {
        card.hidden = category !== 'all' && !(card.dataset.category || '').split(/[\s,]+/).includes(category);
      });
    }

    async function copyEmail() {
      const email = 'amaldev.psn@gmail.com';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(email);
        toast('Email copied. Say hello — I’d love to hear from you.');
      } catch {
        toast(`Copy this email: ${email}`);
      }
    }

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target;
      const questToggle = target.closest('[data-quest-toggle]');
      if (!questToggle && !target.closest('#quest-panel')) setQuestPanel(false);
      if (!target.closest('[data-menu], #mobile-nav')) setMenu(false);
      const button = target.closest('[data-start], [data-quest-toggle], [data-sound], [data-terminal], [data-close-dialog], [data-filter], [data-project], [data-loadout], [data-copy-email], [data-menu], [data-reset-progress], [data-nav], #mobile-nav a[href^="#"]');
      if (!button) return;
      unlockAudio();

      if (button.hasAttribute('data-start')) {
        event.preventDefault();
        const canvas = $('#world-canvas') || $('#game-canvas') || $('canvas');
        const stage = canvas?.closest('.world-stage') || canvas;
        stage?.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center' });
        if (canvas) {
          if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
          canvas.focus({ preventScroll: true });
        }
        document.dispatchEvent(new CustomEvent('portfolio:start'));
      } else if (button.hasAttribute('data-quest-toggle')) {
        event.preventDefault();
        setQuestPanel($('#quest-panel')?.hidden !== false);
      } else if (button.hasAttribute('data-sound')) {
        soundEnabled = !soundEnabled;
        if (soundEnabled) unlockAudio();
        persist();
        renderSound();
      } else if (button.hasAttribute('data-terminal')) {
        event.preventDefault();
        openTerminal();
      } else if (button.hasAttribute('data-close-dialog')) {
        closeDialog(button.closest('dialog'));
      } else if (button.hasAttribute('data-filter')) {
        filterProjects(button.dataset.filter);
      } else if (button.hasAttribute('data-project')) {
        event.preventDefault();
        openProject(button.dataset.project);
      } else if (button.hasAttribute('data-loadout')) {
        setLoadout(button.dataset.loadout);
      } else if (button.hasAttribute('data-copy-email')) {
        event.preventDefault();
        copyEmail();
      } else if (button.hasAttribute('data-menu')) {
        setMenu($('#mobile-nav')?.hidden !== false);
      } else if (button.hasAttribute('data-reset-progress')) {
        resetProgress();
      } else if (button.hasAttribute('data-nav') || button.matches('#mobile-nav a[href^="#"]')) {
        const section = button.dataset.nav || button.getAttribute('href');
        if (section && document.getElementById(section.replace(/^#/, ''))) {
          event.preventDefault();
          navigate(section, true);
        }
      }
    });

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openTerminal();
      }
      if (event.key === 'Escape') {
        if ($('#quest-panel') && !$('#quest-panel').hidden) {
          setQuestPanel(false);
          $('[data-quest-toggle]')?.focus();
        }
        if ($('#mobile-nav') && !$('#mobile-nav').hidden) {
          setMenu(false);
          $('[data-menu]')?.focus();
        }
      }
    });

    document.addEventListener('pointerdown', unlockAudio, { passive: true });
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('portfolio:collect', (event) => award(event.detail?.id));
    document.addEventListener('portfolio:navigate', (event) => navigate(event.detail?.section, true));
    document.addEventListener('portfolio:request-progress', emitProgress);

    $('#terminal-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = $('#terminal-input');
      if (!input) return;
      const command = input.value;
      input.value = '';
      runCommand(command);
    });

    $('#terminal-input')?.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      if (!commandHistory.length) return;
      event.preventDefault();
      const input = event.currentTarget;
      if (historyIndex === commandHistory.length) historyDraft = input.value;
      historyIndex = event.key === 'ArrowUp'
        ? Math.max(0, historyIndex - 1)
        : Math.min(commandHistory.length, historyIndex + 1);
      input.value = commandHistory[historyIndex] ?? historyDraft;
      input.setSelectionRange(input.value.length, input.value.length);
    });

    $$('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
      });
    });

    if ('IntersectionObserver' in window) {
      const visibleSections = new Map();
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.intersectionRatio);
            if (entry.target.id === 'about') award('explore');
            if (entry.target.id === 'contact') award('contact');
          } else visibleSections.delete(entry.target.id);
        });
        const mostVisible = Array.from(visibleSections.entries()).sort((a, b) => b[1] - a[1])[0];
        if (mostVisible) setActiveSection(mostVisible[0]);
      }, { rootMargin: '-12% 0px -30% 0px', threshold: [0, 0.1, 0.3, 0.5] });
      $$('.quest-section[id]').forEach((section) => observer.observe(section));

      const revealObserver = new IntersectionObserver((entries, reveal) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('revealed', 'in-view');
          reveal.unobserve(entry.target);
        });
      }, { threshold: 0.06 });
      $$('.reveal').forEach((element) => {
        if (reducedMotion.matches) element.classList.add('revealed', 'in-view');
        else revealObserver.observe(element);
      });
    } else {
      $$('.reveal').forEach((element) => element.classList.add('revealed', 'in-view'));
    }

    if ($('#footer-year')) $('#footer-year').textContent = String(new Date().getFullYear());
    setLoadout($('[data-loadout][aria-pressed="true"]')?.dataset.loadout || 'frontend', false);
    renderSound();
    renderProgress();
    document.body.classList.add('js-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
