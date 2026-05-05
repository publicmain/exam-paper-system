import { z } from 'zod';

/**
 * Variant generation input. `mode` controls what gets shuffled:
 *   - shuffle_options    : same question order for all students, but
 *                          MCQ options are relettered per student.
 *   - shuffle_questions  : MCQ options stay put, question order is
 *                          permuted per student.
 *   - both               : both shuffles applied.
 */
export const GenerateForClassSchema = z.object({
  assignmentId: z.string().min(1),
  mode: z.enum(['shuffle_options', 'shuffle_questions', 'both']).default('both'),
});
export type GenerateForClassDto = z.infer<typeof GenerateForClassSchema>;
