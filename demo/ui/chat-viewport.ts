export class ChatViewport {
    constructor(
        private readonly container: HTMLElement,
        private readonly scrollButton: HTMLButtonElement | null
    ) {
        this.container.addEventListener('scroll', () => this.checkScroll());
        this.scrollButton?.addEventListener('click', () => this.scrollToBottom());
        this.checkScroll();
    }

    scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
        this.container.scrollTo({
            top: this.container.scrollHeight,
            behavior,
        });
    }

    isNearBottom(threshold = 150): boolean {
        return this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight < threshold;
    }

    checkScroll(): void {
        this.scrollButton?.classList.toggle('hidden', this.isNearBottom());
    }
}
