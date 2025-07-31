class PomodoroTimer {
    constructor() {
        this.settings = {
            workDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            longBreakInterval: 4,
            soundEnabled: true,
            soundVolume: 50,
            notificationSound: 'bell',
            theme: 'light',
            accentColor: 'blue',
            autoStartBreaks: true,
            autoStartWork: false,
            dailyGoal: 8,
            showNotifications: true
        };

        this.state = {
            isRunning: false,
            isPaused: false,
            currentSession: 'work',
            sessionCount: 1,
            completedPomodoros: 0,
            currentStreak: 0,
            totalFocusTime: 0,
            timeRemaining: 0,
            startTime: null,
            sessionStartTime: null
        };

        this.stats = {
            daily: {},
            weekly: {},
            monthly: {},
            allTime: {
                totalPomodoros: 0,
                totalFocusTime: 0,
                longestStreak: 0,
                averageSessionLength: 0
            }
        };

        this.audioContext = null;
        this.timerInterval = null;
        this.notificationTimeout = null;

        this.initializeElements();
        this.loadSettings();
        this.loadStats();
        this.setupEventListeners();
        this.updateDisplay();
        this.setupAudioContext();
        this.requestNotificationPermission();
        this.applyTheme();
    }

    initializeElements() {
        this.elements = {
            timeDisplay: document.getElementById('timeDisplay'),
            sessionType: document.getElementById('sessionType'),
            sessionCount: document.getElementById('sessionCount'),
            startPauseBtn: document.getElementById('startPauseBtn'),
            resetBtn: document.getElementById('resetBtn'),
            skipBtn: document.getElementById('skipBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            progressCircle: document.getElementById('progressCircle'),
            completedPomodoros: document.getElementById('completedPomodoros'),
            totalFocusTime: document.getElementById('totalFocusTime'),
            currentStreak: document.getElementById('currentStreak'),
            todayGoal: document.getElementById('todayGoal'),
            settingsModal: document.getElementById('settingsModal'),
            statsModal: document.getElementById('statsModal'),
            closeSettingsBtn: document.getElementById('closeSettingsBtn'),
            closeStatsBtn: document.getElementById('closeStatsBtn'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            resetSettingsBtn: document.getElementById('resetSettingsBtn')
        };

        this.settingInputs = {
            workDuration: document.getElementById('workDuration'),
            shortBreakDuration: document.getElementById('shortBreakDuration'),
            longBreakDuration: document.getElementById('longBreakDuration'),
            longBreakInterval: document.getElementById('longBreakInterval'),
            soundEnabled: document.getElementById('soundEnabled'),
            soundVolume: document.getElementById('soundVolume'),
            notificationSound: document.getElementById('notificationSound'),
            theme: document.getElementById('theme'),
            accentColor: document.getElementById('accentColor'),
            autoStartBreaks: document.getElementById('autoStartBreaks'),
            autoStartWork: document.getElementById('autoStartWork'),
            dailyGoal: document.getElementById('dailyGoal'),
            showNotifications: document.getElementById('showNotifications')
        };
    }

    setupEventListeners() {
        this.elements.startPauseBtn.addEventListener('click', () => this.toggleTimer());
        this.elements.resetBtn.addEventListener('click', () => this.resetTimer());
        this.elements.skipBtn.addEventListener('click', () => this.skipSession());
        this.elements.settingsBtn.addEventListener('click', () => this.openSettingsModal());
        this.elements.closeSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
        this.elements.closeStatsBtn.addEventListener('click', () => this.closeStatsModal());
        this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.elements.resetSettingsBtn.addEventListener('click', () => this.resetSettings());

        this.settingInputs.soundVolume.addEventListener('input', (e) => {
            document.getElementById('volumeValue').textContent = e.target.value + '%';
        });

        this.settingInputs.theme.addEventListener('change', () => this.applyTheme());
        this.settingInputs.accentColor.addEventListener('change', () => this.applyTheme());

        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeSettingsModal();
                this.closeStatsModal();
            }
        });

        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.updateDetailedStats(e.target.dataset.period);
            });
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state.isRunning) {
                this.updateTitle();
            } else if (!document.hidden) {
                document.title = 'ポモドーロタイマー';
            }
        });
    }

    setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Audio context not available:', e);
        }
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                this.showNotificationPrompt();
            }
        }
    }

    showNotificationPrompt() {
        const prompt = document.createElement('div');
        prompt.className = 'notification-permission';
        prompt.innerHTML = `
            <span>通知を有効にしてタイマーの完了をお知らせします</span>
            <button onclick="this.parentElement.remove(); Notification.requestPermission()">許可する</button>
        `;
        document.querySelector('.timer-section').prepend(prompt);
    }

    loadSettings() {
        const saved = localStorage.getItem('pomodoroSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        this.populateSettingsModal();
    }

    loadStats() {
        const saved = localStorage.getItem('pomodoroStats');
        if (saved) {
            this.stats = { ...this.stats, ...JSON.parse(saved) };
        }
        
        const today = this.getDateString();
        if (!this.stats.daily[today]) {
            this.stats.daily[today] = {
                completedPomodoros: 0,
                totalFocusTime: 0,
                sessions: []
            };
        }

        this.state.completedPomodoros = this.stats.daily[today].completedPomodoros;
        this.state.totalFocusTime = this.stats.daily[today].totalFocusTime;
        this.updateStreak();
    }

    saveSettings() {
        Object.keys(this.settingInputs).forEach(key => {
            const input = this.settingInputs[key];
            if (input.type === 'checkbox') {
                this.settings[key] = input.checked;
            } else if (input.type === 'number' || input.type === 'range') {
                this.settings[key] = parseInt(input.value);
            } else {
                this.settings[key] = input.value;
            }
        });

        localStorage.setItem('pomodoroSettings', JSON.stringify(this.settings));
        this.applyTheme();
        this.closeSettingsModal();
        this.resetTimer();
    }

    resetSettings() {
        this.settings = {
            workDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            longBreakInterval: 4,
            soundEnabled: true,
            soundVolume: 50,
            notificationSound: 'bell',
            theme: 'light',
            accentColor: 'blue',
            autoStartBreaks: true,
            autoStartWork: false,
            dailyGoal: 8,
            showNotifications: true
        };
        this.populateSettingsModal();
    }

    populateSettingsModal() {
        Object.keys(this.settingInputs).forEach(key => {
            const input = this.settingInputs[key];
            if (input.type === 'checkbox') {
                input.checked = this.settings[key];
            } else {
                input.value = this.settings[key];
            }
        });
        document.getElementById('volumeValue').textContent = this.settings.soundVolume + '%';
    }

    applyTheme() {
        const theme = this.settings.theme === 'auto' ? 
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
            this.settings.theme;
        
        document.body.setAttribute('data-theme', theme);
        document.body.setAttribute('data-accent', this.settings.accentColor);
    }

    toggleTimer() {
        if (this.state.isRunning) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        if (this.state.timeRemaining === 0) {
            this.initializeSession();
        }

        this.state.isRunning = true;
        this.state.isPaused = false;
        this.state.startTime = Date.now() - (this.getCurrentSessionDuration() * 60 * 1000 - this.state.timeRemaining);
        
        this.elements.startPauseBtn.textContent = '一時停止';
        this.elements.startPauseBtn.classList.add('pulse');
        
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
        this.updateTitle();
    }

    pauseTimer() {
        this.state.isRunning = false;
        this.state.isPaused = true;
        
        this.elements.startPauseBtn.textContent = '再開';
        this.elements.startPauseBtn.classList.remove('pulse');
        
        clearInterval(this.timerInterval);
        document.title = 'ポモドーロタイマー';
    }

    resetTimer() {
        this.state.isRunning = false;
        this.state.isPaused = false;
        
        this.elements.startPauseBtn.textContent = '開始';
        this.elements.startPauseBtn.classList.remove('pulse');
        
        clearInterval(this.timerInterval);
        this.initializeSession();
        this.updateDisplay();
        document.title = 'ポモドーロタイマー';
    }

    skipSession() {
        if (this.state.isRunning) {
            this.completeSession();
        } else {
            this.switchSession();
        }
    }

    initializeSession() {
        const duration = this.getCurrentSessionDuration();
        this.state.timeRemaining = duration * 60 * 1000;
        this.state.sessionStartTime = Date.now();
    }

    getCurrentSessionDuration() {
        if (this.state.currentSession === 'work') {
            return this.settings.workDuration;
        } else if (this.state.currentSession === 'shortBreak') {
            return this.settings.shortBreakDuration;
        } else {
            return this.settings.longBreakDuration;
        }
    }

    updateTimer() {
        this.state.timeRemaining -= 1000;
        
        if (this.state.timeRemaining <= 0) {
            this.completeSession();
            return;
        }
        
        this.updateDisplay();
        this.updateTitle();
    }

    completeSession() {
        this.state.isRunning = false;
        this.elements.startPauseBtn.textContent = '開始';
        this.elements.startPauseBtn.classList.remove('pulse');
        clearInterval(this.timerInterval);

        if (this.state.currentSession === 'work') {
            this.recordCompletedPomodoro();
        }

        this.playNotificationSound();
        this.showNotification();
        this.switchSession();
        
        if (this.shouldAutoStart()) {
            setTimeout(() => this.startTimer(), 2000);
        }
    }

    recordCompletedPomodoro() {
        const now = Date.now();
        const sessionDuration = now - this.state.sessionStartTime;
        const today = this.getDateString();

        this.state.completedPomodoros++;
        this.state.totalFocusTime += Math.floor(sessionDuration / (1000 * 60));
        this.state.currentStreak++;

        if (!this.stats.daily[today]) {
            this.stats.daily[today] = { completedPomodoros: 0, totalFocusTime: 0, sessions: [] };
        }

        this.stats.daily[today].completedPomodoros = this.state.completedPomodoros;
        this.stats.daily[today].totalFocusTime = this.state.totalFocusTime;
        this.stats.daily[today].sessions.push({
            start: this.state.sessionStartTime,
            end: now,
            duration: sessionDuration,
            type: 'work'
        });

        this.stats.allTime.totalPomodoros++;
        this.stats.allTime.totalFocusTime += Math.floor(sessionDuration / (1000 * 60));
        
        if (this.state.currentStreak > this.stats.allTime.longestStreak) {
            this.stats.allTime.longestStreak = this.state.currentStreak;
        }

        this.saveStats();
    }

    switchSession() {
        if (this.state.currentSession === 'work') {
            if (this.state.sessionCount % this.settings.longBreakInterval === 0) {
                this.state.currentSession = 'longBreak';
            } else {
                this.state.currentSession = 'shortBreak';
            }
        } else {
            this.state.currentSession = 'work';
            this.state.sessionCount++;
        }

        this.initializeSession();
        this.updateDisplay();
        this.updateSessionType();
        document.title = 'ポモドーロタイマー';
    }

    shouldAutoStart() {
        return (this.state.currentSession === 'work' && this.settings.autoStartWork) ||
               (this.state.currentSession !== 'work' && this.settings.autoStartBreaks);
    }

    updateDisplay() {
        const minutes = Math.floor(this.state.timeRemaining / (1000 * 60));
        const seconds = Math.floor((this.state.timeRemaining % (1000 * 60)) / 1000);
        
        this.elements.timeDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        this.elements.sessionCount.textContent = this.state.sessionCount;
        this.elements.completedPomodoros.textContent = this.state.completedPomodoros;
        
        const hours = Math.floor(this.state.totalFocusTime / 60);
        const remainingMinutes = this.state.totalFocusTime % 60;
        this.elements.totalFocusTime.textContent = `${hours}h ${remainingMinutes}m`;
        
        this.elements.currentStreak.textContent = this.state.currentStreak;
        this.elements.todayGoal.textContent = `${this.state.completedPomodoros}/${this.settings.dailyGoal}`;
        
        this.updateProgressCircle();
        this.updateSessionType();
    }

    updateProgressCircle() {
        const totalDuration = this.getCurrentSessionDuration() * 60 * 1000;
        const progress = 1 - (this.state.timeRemaining / totalDuration);
        const circumference = 2 * Math.PI * 140;
        const offset = circumference * (1 - progress);
        
        this.elements.progressCircle.style.strokeDashoffset = offset;
    }

    updateSessionType() {
        const sessionNames = {
            work: '作業時間',
            shortBreak: '短い休憩',
            longBreak: '長い休憩'
        };
        
        this.elements.sessionType.textContent = sessionNames[this.state.currentSession];
        
        document.body.className = this.state.currentSession === 'work' ? 'work-mode' : 'break-mode';
    }

    updateTitle() {
        if (this.state.isRunning) {
            const minutes = Math.floor(this.state.timeRemaining / (1000 * 60));
            const seconds = Math.floor((this.state.timeRemaining % (1000 * 60)) / 1000);
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            const sessionName = this.state.currentSession === 'work' ? '作業' : '休憩';
            document.title = `${timeString} - ${sessionName} | ポモドーロタイマー`;
        }
    }

    updateStreak() {
        const today = this.getDateString();
        const yesterday = this.getDateString(new Date(Date.now() - 86400000));
        
        if (this.stats.daily[yesterday] && this.stats.daily[yesterday].completedPomodoros > 0) {
            this.state.currentStreak = this.stats.daily[today]?.completedPomodoros || 0;
        } else {
            this.state.currentStreak = this.stats.daily[today]?.completedPomodoros || 0;
        }
    }

    playNotificationSound() {
        if (!this.settings.soundEnabled || !this.audioContext) return;

        try {
            const frequency = this.getSoundFrequency();
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.settings.soundVolume / 100 * 0.3, this.audioContext.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.8);
        } catch (e) {
            console.warn('Could not play sound:', e);
        }
    }

    getSoundFrequency() {
        const sounds = {
            bell: 800,
            chime: 600,
            ding: 1000,
            pop: 400
        };
        return sounds[this.settings.notificationSound] || 800;
    }

    showNotification() {
        if (!this.settings.showNotifications || Notification.permission !== 'granted') return;

        const sessionName = this.state.currentSession === 'work' ? '作業時間' : '休憩時間';
        const message = this.state.currentSession === 'work' ? 
            '作業セッションが完了しました！休憩しましょう。' : 
            '休憩が終了しました。作業を再開しましょう！';

        const notification = new Notification(`${sessionName}完了`, {
            body: message,
            icon: '/favicon.ico',
            tag: 'pomodoro-timer'
        });

        setTimeout(() => notification.close(), 5000);
    }

    handleKeyboardShortcuts(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.toggleTimer();
                break;
            case 'KeyR':
                e.preventDefault();
                this.resetTimer();
                break;
            case 'KeyS':
                e.preventDefault();
                this.skipSession();
                break;
            case 'Escape':
                this.closeSettingsModal();
                this.closeStatsModal();
                break;
        }
    }

    openSettingsModal() {
        this.elements.settingsModal.classList.add('show');
        this.populateSettingsModal();
    }

    closeSettingsModal() {
        this.elements.settingsModal.classList.remove('show');
    }

    openStatsModal() {
        this.elements.statsModal.classList.add('show');
        this.updateDetailedStats('today');
    }

    closeStatsModal() {
        this.elements.statsModal.classList.remove('show');
    }

    updateDetailedStats(period) {
        const container = document.getElementById('detailedStats');
        let stats = {};

        switch (period) {
            case 'today':
                const today = this.getDateString();
                stats = this.stats.daily[today] || { completedPomodoros: 0, totalFocusTime: 0 };
                break;
            case 'week':
                stats = this.getWeeklyStats();
                break;
            case 'month':
                stats = this.getMonthlyStats();
                break;
            case 'all':
                stats = this.stats.allTime;
                break;
        }

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.completedPomodoros || stats.totalPomodoros || 0}</div>
                <div class="stat-label">完了したポモドーロ</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Math.floor((stats.totalFocusTime || 0) / 60)}h ${(stats.totalFocusTime || 0) % 60}m</div>
                <div class="stat-label">集中時間</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.longestStreak || 0}</div>
                <div class="stat-label">最長ストリーク</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Math.round((stats.averageSessionLength || 0) / 60) || 0}分</div>
                <div class="stat-label">平均セッション時間</div>
            </div>
        `;
    }

    getWeeklyStats() {
        const stats = { completedPomodoros: 0, totalFocusTime: 0, longestStreak: 0, averageSessionLength: 0 };
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateString = this.getDateString(date);
            const dayStats = this.stats.daily[dateString];
            
            if (dayStats) {
                stats.completedPomodoros += dayStats.completedPomodoros;
                stats.totalFocusTime += dayStats.totalFocusTime;
            }
        }
        
        return stats;
    }

    getMonthlyStats() {
        const stats = { completedPomodoros: 0, totalFocusTime: 0, longestStreak: 0, averageSessionLength: 0 };
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        Object.keys(this.stats.daily).forEach(dateString => {
            const date = new Date(dateString);
            if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                const dayStats = this.stats.daily[dateString];
                stats.completedPomodoros += dayStats.completedPomodoros;
                stats.totalFocusTime += dayStats.totalFocusTime;
            }
        });
        
        return stats;
    }

    getDateString(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    saveStats() {
        localStorage.setItem('pomodoroStats', JSON.stringify(this.stats));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PomodoroTimer();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}