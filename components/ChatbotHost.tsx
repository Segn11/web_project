'use client';

import dynamic from 'next/dynamic';

const Chatbot = dynamic(() => import('@/components/Chatbot').then((mod) => mod.Chatbot), {
  ssr: false,
});

export function ChatbotHost() {
  return <Chatbot />;
}