export type Note = {
  id: string;
  userId: string;
  title: string;
  content: string;
  summary: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  _id?: string;
};

export type CreateNoteDto = {
  title: string;
  content: string;
};

export type UpdateNoteDto = Partial<Pick<Note, 'title' | 'content' | 'summary'>>;
