import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={
 title:'상권 Atlas Beta · 한국·일본 출점 검토',
 description:'내 예산에 맞는 음식점 업종, 지역 수요, 주변 경쟁점과 출점 비용을 비교하는 모바일 창업 워크스페이스.',
 icons:{icon:'/icon.svg'},manifest:'/manifest.webmanifest',robots:{index:false,follow:false},
};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#174b3e'};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="ko"><head><link rel="stylesheet" href="/styles.css"/><link rel="stylesheet" href="/opening.css" data-opening-style="true"/><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.15.0/dist/maplibre-gl.css"/></head><body>{children}</body></html>;
}
