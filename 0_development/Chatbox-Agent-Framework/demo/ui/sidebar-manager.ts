const STORAGE_KEY = 'chatbox-sidebar-open';

export class SidebarManager {
    private isOpen: boolean;

    constructor(
        private readonly sidebar: HTMLElement,
        private readonly overlay: HTMLElement | null
    ) {
        const savedState = localStorage.getItem(STORAGE_KEY);
        this.isOpen = savedState !== null ? savedState === 'true' : window.innerWidth >= 768;

        this.overlay?.addEventListener('click', () => this.close());
        this.applyState();
    }

    toggle(): void {
        this.isOpen = !this.isOpen;
        this.persist();
        this.applyState();
    }

    open(): void {
        this.isOpen = true;
        this.persist();
        this.applyState();
    }

    close(): void {
        this.isOpen = false;
        this.persist();
        this.applyState();
    }

    applyState(): void {
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            if (this.isOpen) {
                this.sidebar.classList.remove('-translate-x-full');
                this.overlay?.classList.add('active');
                document.body.style.overflow = 'hidden';
            } else {
                this.sidebar.classList.add('-translate-x-full');
                this.overlay?.classList.remove('active');
                document.body.style.overflow = '';
            }
            document.body.classList.remove('sidebar-collapsed');
        } else {
            this.sidebar.classList.remove('-translate-x-full');
            this.overlay?.classList.remove('active');
            document.body.style.overflow = '';
            document.body.classList.toggle('sidebar-collapsed', !this.isOpen);
        }
    }

    private persist() {
        localStorage.setItem(STORAGE_KEY, String(this.isOpen));
    }
}
