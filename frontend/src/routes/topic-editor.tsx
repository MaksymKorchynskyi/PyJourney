import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { TopicEditor } from "@/features/topics/topic-editor";
import { topicsQuery } from "@/lib/queries";

const editRoute = getRouteApi("/app/topics/$topicId/edit");

export function NewTopicPage() {
  return <TopicEditor />;
}

export function EditTopicPage() {
  const { topicId } = editRoute.useParams();
  const { data: topics } = useSuspenseQuery(topicsQuery);
  const topic = topics.find((item) => String(item.id) === topicId);
  return <TopicEditor key={topicId} topic={topic} />;
}
