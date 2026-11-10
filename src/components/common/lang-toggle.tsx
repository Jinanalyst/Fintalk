"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 한국어 ↔ English 전환.
 * 구글 번역 위젯(googtrans 쿠키)을 사용하며, 영문 모드일 때만 번역 스크립트를 불러옵니다.
 */

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: { translate: { TranslateElement: new (o: Record<string, unknown>, id: string) => unknown } };
  }
}

const COOKIE = "googtrans";

const isEnglish = () => /(?:^|;\s*)googtrans=\/ko\/en/.test(document.cookie);

/** googtrans 쿠키를 도메인·상위 도메인·점(.) 접두 변형까지 모두 지웁니다. (구글이 상위 도메인에 따로 심는 경우가 있음) */
const clearCookie = () => {
  const expire = "expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
  const parts = location.hostname.split(".");
  const domains = new Set<string>([location.hostname, `.${location.hostname}`]);
  for (let i = 1; i < parts.length - 1; i++) {
    const d = parts.slice(i).join(".");
    domains.add(d);
    domains.add(`.${d}`);
  }
  document.cookie = `${COOKIE}=; ${expire}; path=/`;
  for (const d of domains) document.cookie = `${COOKIE}=; ${expire}; path=/; domain=${d}`;
};

const setLang = (en: boolean) => {
  clearCookie();
  if (en) document.cookie = `${COOKIE}=/ko/en; path=/; max-age=31536000`;
  location.reload();
};

/** 번역기가 텍스트 노드를 <font> 로 감싸면서 React 의 DOM 갱신이 깨지는 문제를 막는 보정 */
function patchDomForTranslator() {
  const w = window as unknown as { __dom_patched?: boolean };
  if (w.__dom_patched) return;
  w.__dom_patched = true;
  const remove = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return remove.call(this, child) as T;
  };
  const insert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return node;
    return insert.call(this, node, ref) as T;
  };
}

/** 번역기가 브랜드명 "핀톡"을 Pintalk 등으로 옮기므로 FinTalk 로 되돌립니다. */
const BRAND_RE = /\b(?:Pin[ -]?talk|Fin[ -]talk|Pintalk)\b/gi;
function fixBrand(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue;
    if (t && BRAND_RE.test(t)) {
      BRAND_RE.lastIndex = 0;
      n.nodeValue = t.replace(BRAND_RE, "FinTalk");
    }
    BRAND_RE.lastIndex = 0;
  }
  if (root instanceof Element) {
    for (const el of root.querySelectorAll<HTMLElement>("[aria-label],[title]")) {
      for (const a of ["aria-label", "title"]) {
        const v = el.getAttribute(a);
        if (v && /Pin[ -]?talk/i.test(v)) el.setAttribute(a, v.replace(/Pin[ -]?talk/gi, "FinTalk"));
      }
    }
  }
}

function watchBrand() {
  fixBrand(document.body);
  if (!/Pin[ -]?talk/i.test(document.title)) return;
  document.title = document.title.replace(/Pin[ -]?talk/gi, "FinTalk");
}

export function LangToggle() {
  const [en, setEn] = useState(false);

  useEffect(() => {
    if (!isEnglish()) return;
    setEn(true);
    patchDomForTranslator();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const mo = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(watchBrand, 150); // 번역이 끝난 뒤 한 번에 보정
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "title"] });
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    if (document.getElementById("google-translate-script")) return;
    const box = document.createElement("div");
    box.id = "google_translate_element";
    box.className = "notranslate";
    document.body.appendChild(box);
    window.googleTranslateElementInit = () => {
      new window.google!.translate.TranslateElement({ pageLanguage: "ko", includedLanguages: "en,ko", autoDisplay: false }, "google_translate_element");
    };
    const s = document.createElement("script");
    s.id = "google-translate-script";
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return (
    <Button
      variant="ghost"
      size="lg"
      className="notranslate gap-1 px-2 max-sm:size-9 max-sm:px-0"
      aria-label={en ? "한국어로 보기" : "View in English"}
      title={en ? "한국어로 보기" : "View in English (machine translation)"}
      onClick={() => setLang(!en)}
    >
      <Languages className="size-[18px]" />
      <span className="text-xs font-semibold max-sm:hidden">{en ? "한국어" : "EN"}</span>
    </Button>
  );
}
