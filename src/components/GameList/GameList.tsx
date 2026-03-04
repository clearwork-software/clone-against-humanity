'use client'

// Types
import type { Game } from '@/types/game.type'

// React
import { useEffect, useState } from 'react'

// Next
import { useRouter } from 'next/navigation'

// Redux
import { useAppSelector } from '@/redux/store'

// Fetch
import { GET, PUT } from '@/lib/fetch'

// Components
import Chip from '../Chip'

// Socket
import { useSocket } from '@/providers/SocketProvider'

// Toast
import { useToast } from '@/providers/ToastProvider'

const GameList = () => {
	const auth = useAppSelector(({ auth }) => auth)
	const { socket } = useSocket()
	const { showToast } = useToast()

	const [games, setGames] = useState<Array<any>>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const getGames = async () => {
			try {
				const games = await GET('/games')
				setGames(games)
			} catch {
				showToast('Failed to load games')
			} finally {
				setLoading(false)
			}
		}

		getGames()

		const interval = setInterval(async () => {
			try {
				const games = await GET('/games')
				setGames(games)
			} catch {
				// Silently fail on periodic refetch
			}
		}, 30000)

		return () => clearInterval(interval)
	}, [])

	useEffect(() => {
		if (!socket) return

		const onGameCreated = (game: Game) => {
			setGames((prev) => [...prev, game])
		}

		const onGameUpdated = (game: Game) => {
			setGames((prev) =>
				prev.map((g) => (g.id === game.id ? game : g))
			)
		}

		socket.on('game_created', onGameCreated)
		socket.on('game_updated', onGameUpdated)

		return () => {
			socket.off('game_created', onGameCreated)
			socket.off('game_updated', onGameUpdated)
		}
	}, [socket])

	if (loading) {
		return (
			<div className='py-12 text-center text-gray-500'>
				<p>Loading games...</p>
			</div>
		)
	}

	if (games.length === 0) {
		return (
			<div className='py-12 text-center text-gray-500'>
				<p className='text-lg font-medium'>No games yet</p>
				<p className='mt-1 text-sm'>Create a game to get started.</p>
			</div>
		)
	}

	return (
		<div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
			{games.map((game) => (
				<Item key={game.id} game={game} />
			))}
		</div>
	)
}

const Item = ({ game }: { game: any }) => {
	const router = useRouter()

	const auth = useAppSelector(({ auth }) => auth)
	const { showToast } = useToast()

	const handleJoinGame = async () => {
		try {
			await PUT(`/games/${game.id}/join`, {
				player_id: auth.id,
			})

			router.push(`/games/${game.id}`)
		} catch {
			showToast('Failed to join game')
		}
	}

	return (
		<div className='p-4 border rounded'>
			<div className='flex items-center space-x-4'>
				<p className='font-medium'>{game.name}</p>
				<Chip>
					{game?.players?.length || 0}/{game.max_players} players
				</Chip>
			</div>
			{auth.username && (
				<button onClick={handleJoinGame} className='ml-auto button'>
					Join Game
				</button>
			)}
		</div>
	)
}

export default GameList
