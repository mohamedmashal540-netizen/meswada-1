import { Op } from 'sequelize';
import { Note } from '../models/Note';
import { CreateNoteInput, UpdateNoteInput } from '../validators/notes.schema';
import { AppError } from '../middlewares/errorHandler';

export interface ListNotesOptions {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ListNotesResult {
  notes: Note[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class NotesService {
  async findAllByUserId(userId: string, options: ListNotesOptions = {}): Promise<ListNotesResult> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const search = options.search?.trim();

    const where: Record<string | symbol, unknown> = { userId };

    if (search) {
      // NOTE: SQLite's LIKE is only case-insensitive for ASCII, so this is
      // "good enough" for now but won't do case-insensitive matching for
      // Arabic text. If this app moves to Postgres, switch to Op.iLike.
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await Note.findAndCountAll({
      where,
      order: [['updatedAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      notes: rows,
      total: count,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(count / pageSize)),
    };
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Note> {
    const note = await Note.findOne({
      where: { id, userId },
    });

    if (!note) {
      throw new AppError(404, 'Note not found');
    }

    return note;
  }

  async create(userId: string, data: CreateNoteInput): Promise<Note> {
    return Note.create({
      userId,
      ...data,
    });
  }

  async update(id: string, userId: string, data: UpdateNoteInput): Promise<Note> {
    const note = await this.findByIdAndUserId(id, userId);
    await note.update(data);
    return note;
  }

  async delete(id: string, userId: string): Promise<void> {
    const note = await this.findByIdAndUserId(id, userId);
    await note.destroy();
  }
}

export const notesService = new NotesService();
