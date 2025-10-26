const mfdl = async function (mfUrl) {
    if (!mfUrl || !/^https?:\/\/(www\.)?mediafire\.com\//i.test(mfUrl)) {
        throw Error("Masukkan URL MediaFire yang valid.");
    }

    const r = await fetch(mfUrl, {
        headers: {
            "accept-encoding": "gzip, deflate, br, zstd",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "accept-language": "en-US,en;q=0.9",
        },
    });

    if (!r.ok) throw Error(`${r.status} ${r.statusText}`);

    const html = await r.text();

    // Link download tombol utama
    const url = html.match(/href="(.+?)"\s+id="downloadButton"/)?.[1];
    if (!url) throw Error("gagal menemukan match url");

    // Tipe & ekstensi (contoh: Compressed Archive .ZIP (13.35MB))
    // aslinya: class="filetype"><span>Compressed Archive</span> (.ZIP) (13.35MB)
    const ft_m =
        html.match(/class="filetype"><span>(.+?)<(?:.+?)\s*\((.+?)\)/) ||
        html.match(/class="filetype">([\s\S]*?)<\/div>/);
    const fileType =
        ft_m?.[1] && ft_m?.[2]
            ? `${ft_m[1]} ${ft_m[2]}`
            : (ft_m?.[1]?.replace(/<[^>]+>/g, " ").trim() || "(no ext)");

    // Blok deskripsi ekstensi
    const d_m = html.match(/<div class="description">([\s\S]+?)<\/div>/);
    const block = d_m?.[1] || "";
    const titleExt =
        block.match(/subheading">([^<]+)</)?.[1] || "(no title extension)";
    const descriptionExt =
        block.match(/<p>([\s\S]+?)<\/p>/)?.[1]?.replace(/\s+/g, " ").trim() ||
        "(no about extension)";

    // Ukuran/file/date/nama (beberapa halaman pakai label berbeda)
    const fileSize =
        html.match(/File size:\s*<span>([^<]+)<\/span>/)?.[1] ||
        html.match(/(?:Size|File size)\s*[:]\s*<span>([^<]+)<\/span>/)?.[1] ||
        "(no file size)";

    const uploaded =
        html.match(/Uploaded:\s*<span>([^<]+)<\/span>/)?.[1] || "(no date)";

    const fileName =
        html.match(/class="filename">([^<]+)<\/div>/)?.[1] ||
        html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ||
        "(no file name)";

    return {
        fileName,
        fileSize,
        url,
        uploaded,
        fileType,
        titleExt,
        descriptionExt,
        link: mfUrl,
    };
};

// ---- CLI ----
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log(`
╔═══════════════════════════════════════════════╗
║        Mediafire Downloader CLI              ║
╚═══════════════════════════════════════════════╝

Usage:
  node mfdl.js <mediafire_url>

Arguments:
  mediafire_url - Mediafire file URL (required)

Example:
  node mfdl.js "https://mediafire.com/file/xxxxx"
`);
    process.exit(0);
}

(async () => {
    try {
        const input = args[0];
        
        console.log(`
🚀 Fetching Mediafire...
🔗 URL: ${input}
`);

        const data = await mfdl(input);
        
        console.log('\n✅ SUCCESS!');
        console.log('═'.repeat(60));
        console.log(`File Name   : ${data.fileName}`);
        console.log(`File Size   : ${data.fileSize}`);
        console.log(`File Type   : ${data.fileType}`);
        console.log(`Uploaded    : ${data.uploaded}`);
        console.log(`Title       : ${data.titleExt}`);
        console.log(`Description : ${data.descriptionExt}`);
        console.log('-'.repeat(60));
        console.log(`Download    : ${data.url}`);
        console.log('═'.repeat(60));
        
    } catch (e) {
        console.error('\n❌ ERROR!');
        console.error('═'.repeat(60));
        console.error(e.message);
        console.error('═'.repeat(60));
        process.exit(1);
    }
})();