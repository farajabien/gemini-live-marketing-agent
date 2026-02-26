import { PostAssistantScreen } from "@/components/screens/PostAssistantScreen";

interface PostAssistantPageProps {
  params: Promise<{ id: string }>;
}

export default async function PostAssistantPage({ params }: PostAssistantPageProps) {
  const { id } = await params;
  return <PostAssistantScreen planId={id} />;
}
