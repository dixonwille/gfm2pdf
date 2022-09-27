import { unified } from "https://esm.sh/unified@10.1.2";
import remarkParse from "https://esm.sh/remark-parse@10.0.1";
import remarkGfm from "https://esm.sh/remark-gfm@3.0.1";
import remarkRehype from "https://esm.sh/remark-rehype@10.1.0";
import rehypeStringify from "https://esm.sh/rehype-stringify@9.0.3";
import rehypeDocument from "https://esm.sh/rehype-document@6.1.0";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { toFileUrl } from "https://deno.land/std@0.157.0/path/mod.ts";
import { read, toVFile, write } from "https://esm.sh/to-vfile@7.2.3";
import { VFile } from "https://esm.sh/vfile@5.3.5";
import { dirname, resolve } from "https://deno.land/std@0.157.0/path/mod.ts";
import { parse } from "https://deno.land/std@0.157.0/flags/mod.ts";

type Flags = {
  [x: string]: unknown;
  help: boolean;
  _: string[];
};

type Options = {
  inFile: VFile;
  outFile: string;
};

type ProcessMarkdownOptions = {
  title?: string;
};

type ProcessHtmlToPDFOptions = {
  output?: string;
};

await main();

async function main() {
  const opts = await handleArgs();
  const htmlFile = await processMarkdownToHtml(opts.inFile);
  await processHtmlToPDF(htmlFile, {
    output: opts.outFile,
  });
}

async function handleArgs(): Promise<Options> {
  const flags = parse(Deno.args, {
    boolean: ["help"],
    alias: {
      "help": ["h"],
    },
  }) as Flags;

  if (flags.help) {
    printHelp();
    Deno.exit(0);
  }

  if (flags._.length < 1) {
    console.error("Please specify an <IN_FILE>.");
    printHelp();
    Deno.exit(1);
  }
  const inFile = await read(toVFile(await Deno.realPath(flags._[0])));
  let outFile = `${inFile.stem}.pdf`;
  if (flags._.length > 1) {
    outFile = resolve(flags._[1]);
  }
  Deno.mkdir(dirname(outFile), { recursive: true });
  return {
    inFile,
    outFile,
  };
}

function printHelp() {
  console.log("mk2pdf [OPTIONS] <IN_FILE> [<OUT_FILE>]");
  console.log("Turn a markdown file into a pdf.");
  console.log("");
  console.log("Arguments:");
  console.log("<IN_FILE>      Input file to create a PDF from.");
  console.log("<OUT_FILE>     Output file of the PDF.");
  console.log("               DEFAULT <IN_FILE> with pdf extension.");
  console.log("");
  console.log("OPTIONS:");
  console.log("--help, -h     Print out this help message.");
}

async function processMarkdownToHtml(
  file: VFile,
  opts?: ProcessMarkdownOptions,
): Promise<VFile> {
  opts = {
    title: "My Doc",
    ...opts,
  };
  const f = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeDocument, { title: opts.title })
    .use(rehypeStringify)
    .process(file);

  const tmpFile = await Deno.makeTempFile({
    prefix: "mk2pdf",
    suffix: ".html",
  });
  f.path = tmpFile;
  return write(f);
}

async function processHtmlToPDF(
  html: VFile,
  opts?: ProcessHtmlToPDFOptions,
): Promise<VFile> {
  opts = {
    output: `${html.stem}.pdf`,
    ...opts,
  };
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(toFileUrl(html.path).toString(), {
    waitUntil: "networkidle2",
  });
  await page.pdf({
    path: opts.output,
  });
  browser.close();
  return read(toVFile(opts.output));
}
