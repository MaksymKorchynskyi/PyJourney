import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { TopicEditor } from "@/features/topics/topic-editor";
import { categoriesQuery, topicQuery } from "@/lib/queries";

const editRoute = getRouteApi("/app/topics/$topicId/edit");

export function NewTopicPage() {
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  return <TopicEditor categories={categories} />;
}

export function EditTopicPage() {
  const { topicId } = editRoute.useParams();
  const { data: topic } = useSuspenseQuery(topicQuery(Number(topicId)));
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  return <TopicEditor key={topicId} topic={topic} categories={categories} />;
}
