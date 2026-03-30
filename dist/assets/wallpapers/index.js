const modules = import.meta.glob('./*.{jpg,jpeg,png,webp,gif}', { eager: true });
export const wallpapers = Object.entries(modules)
    .map(([path, mod]) => {
    const filename = path.split('/').pop();
    const name = filename.replace(/\.[^.]+$/, '');
    return { id: `wallpaper:${name}`, name, url: mod.default };
})
    .sort((a, b) => a.name.localeCompare(b.name));
export const DEFAULT_WALLPAPER_NAME = 'Night Forest';
export const defaultWallpaper = wallpapers.find(w => w.name === DEFAULT_WALLPAPER_NAME) || wallpapers[0];
export const defaultWallpaperName = defaultWallpaper?.name ?? DEFAULT_WALLPAPER_NAME;
export const defaultWallpaperUrl = defaultWallpaper?.url || '';
export const defaultWallpaperId = defaultWallpaper?.id || '';
//# sourceMappingURL=index.js.map