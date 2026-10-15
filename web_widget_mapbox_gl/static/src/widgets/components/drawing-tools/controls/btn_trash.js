import { _t } from '@web/core/l10n/translation';

export function createTrashButton(draw) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_trash';
    btn.title = _t('Delete');
    btn.setAttribute('aria-label', _t('Delete'));
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        draw.trash();
    });
    return btn;
}
