export function fisherYatesShuffleU8(a: Uint8Array): Uint8Array {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i];
        a[i] = a[j];
        a[j] = t; // swap
    }
    return a;
}
