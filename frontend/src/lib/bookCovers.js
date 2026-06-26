import cover1984 from '../assets/1984.svg'
import coverGreatGatsby from '../assets/thegreatgatsby.svg'
import coverMockingbird from '../assets/tokillamockingbird.svg'
import coverCatcher from '../assets/thecatcherintherye.svg'
import coverProud from '../assets/iyanlavanzant.svg'

const BOOK_COVERS_BY_TITLE = {
  'The Great Gatsby': coverGreatGatsby,
  'To Kill a Mockingbird': coverMockingbird,
  '1984': cover1984,
  'The Catcher in the Rye': coverCatcher,
  Proud: coverProud,
}

export function resolveBookCoverSrc(book) {
  if (!book) return null
  if (book.cover_url) return book.cover_url
  if (book.title && BOOK_COVERS_BY_TITLE[book.title]) return BOOK_COVERS_BY_TITLE[book.title]
  return null
}
